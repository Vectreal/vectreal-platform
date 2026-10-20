import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { Entry } from '@napi-rs/keyring'
import { z } from 'zod'

/** One signed-in origin. `expiresAt` is when the access token lapses, in ms. */
const storedSessionSchema = z.object({
	clientId: z.string(),
	authorizationServer: z.string(),
	accessToken: z.string(),
	refreshToken: z.string(),
	expiresAt: z.number()
})

export type StoredSession = z.infer<typeof storedSessionSchema>

/** Secrets by account, where the account is an origin. */
export interface SecretStore {
	get(account: string): string | null
	set(account: string, value: string): void
	delete(account: string): void
}

const KEYCHAIN_SERVICE = 'vectreal-cli'

/**
 * The OS keychain: macOS Keychain, Windows Credential Manager, Secret Service.
 *
 * Kept as UTF-8 bytes, not as a password: on Windows a password is stored as
 * UTF-16 under a 2560-byte cap, which a session carrying a full access token
 * outgrows, and every save would fall back to the file.
 */
export function keychainStore(service = KEYCHAIN_SERVICE): SecretStore {
	const entry = (account: string) => new Entry(service, account)
	return {
		get: (account) => {
			const bytes = entry(account).getSecret()
			return bytes ? new TextDecoder().decode(Uint8Array.from(bytes)) : null
		},
		set: (account, value) =>
			entry(account).setSecret(new TextEncoder().encode(value)),
		delete: (account) => {
			entry(account).deletePassword()
		}
	}
}

/** `$XDG_CONFIG_HOME/vectreal`, else `~/.config/vectreal`. */
export function configDir(env = process.env): string {
	return join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'vectreal')
}

/** A file's JSON, or undefined when it is missing or not JSON (a torn write). */
function readJson(path: string): unknown {
	if (!existsSync(path)) return undefined
	try {
		return JSON.parse(readFileSync(path, 'utf8'))
	} catch {
		return undefined
	}
}

/**
 * Writes beside the file and renames over it, so a crash mid-write leaves the
 * old file rather than half of the new one.
 */
function writeFileAtomic(path: string, text: string, mode: number) {
	const temporary = `${path}.${process.pid}.tmp`
	writeFileSync(temporary, text, { mode })
	chmodSync(temporary, mode)
	renameSync(temporary, path)
}

const secretsFileSchema = z.record(z.string(), z.string())

/**
 * A JSON file only the user can read, for machines with no keychain (a
 * headless Linux box without a Secret Service). Modes are set on every write,
 * since a directory that already exists keeps the mode it had.
 */
export function fileStore(dir: string): SecretStore {
	const path = join(dir, 'credentials.json')
	const read = (): Record<string, string> => {
		const parsed = secretsFileSchema.safeParse(readJson(path))
		return parsed.success ? parsed.data : {}
	}
	const write = (all: Record<string, string>) => {
		mkdirSync(dir, { recursive: true, mode: 0o700 })
		chmodSync(dir, 0o700)
		writeFileAtomic(path, `${JSON.stringify(all, null, '\t')}\n`, 0o600)
	}
	return {
		get: (account) => read()[account] ?? null,
		set: (account, value) => write({ ...read(), [account]: value }),
		delete: (account) => {
			const { [account]: removed, ...rest } = read()
			if (removed !== undefined) write(rest)
		}
	}
}

/**
 * The keychain while it works, the file once it throws, saying so once.
 *
 * Reads look in both: a session saved while the keychain was out of reach (an
 * SSH login on a desktop Linux box) is still found once it is back, and the
 * other way round. Deletes clear both, so signing out leaves nothing behind.
 */
export function fallbackStore(
	primary: SecretStore,
	fallback: SecretStore,
	warn: (message: string) => void
): SecretStore {
	let usable = true
	const onPrimary = <Result>(
		call: () => Result
	): { ok: true; value: Result } | { ok: false } => {
		if (!usable) return { ok: false }
		try {
			return { ok: true, value: call() }
		} catch (error) {
			usable = false
			warn(
				`No usable OS keychain (${error instanceof Error ? error.message : String(error)}); keeping the session in a file only you can read.`
			)
			return { ok: false }
		}
	}
	return {
		get: (account) => {
			const kept = onPrimary(() => primary.get(account))
			return (kept.ok ? kept.value : null) ?? fallback.get(account)
		},
		set: (account, value) => {
			if (onPrimary(() => primary.set(account, value)).ok) {
				// A copy left in the file would hold a refresh token already spent,
				// and reading it back where the keychain is out of reach would trip
				// Auth's reuse detection, which ends the session everywhere.
				fallback.delete(account)
			} else {
				fallback.set(account, value)
				// The keychain may still read where it cannot write (Windows caps a
				// credential's size), and reads prefer it, so its older copy goes.
				try {
					primary.delete(account)
				} catch {
					// Unreachable for deletes too, so unreachable for reads as well.
				}
			}
		},
		delete: (account) => {
			onPrimary(() => primary.delete(account))
			fallback.delete(account)
		}
	}
}

export function loadSession(
	store: SecretStore,
	origin: string
): StoredSession | null {
	const raw = store.get(origin)
	if (!raw) return null
	try {
		const parsed = storedSessionSchema.safeParse(JSON.parse(raw))
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

export function saveSession(
	store: SecretStore,
	origin: string,
	session: StoredSession
): void {
	store.set(origin, JSON.stringify(session))
}

const configSchema = z.object({ defaultOrigin: z.string().optional() })

/** Non-secret settings: which origin to use when none is named. */
export function readConfig(dir: string): z.infer<typeof configSchema> {
	const parsed = configSchema.safeParse(readJson(join(dir, 'config.json')))
	return parsed.success ? parsed.data : {}
}

export function writeConfig(
	dir: string,
	config: z.infer<typeof configSchema>
): void {
	mkdirSync(dir, { recursive: true, mode: 0o700 })
	writeFileAtomic(
		join(dir, 'config.json'),
		`${JSON.stringify(config, null, '\t')}\n`,
		0o644
	)
}
