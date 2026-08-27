/**
 * The storage that makes an embed key selectable.
 *
 * The panel could never show an owner a key they already had, because the only
 * stored form was a one-way hash. This module is the second representation that
 * fixes that, so what matters here is the round trip, and that a value which
 * cannot be trusted comes back as "cannot be shown" rather than as something an
 * attacker picked.
 */

import { createDecipheriv } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { reportServerError } = vi.hoisted(() => ({ reportServerError: vi.fn() }))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError
}))

/** What this module has reported, as strings the assertions below can match. */
const reportedMessages = () =>
	reportServerError.mock.calls.map(([error]) => String(error))

const KEY_ENV = 'EMBED_TOKEN_ENCRYPTION_KEY'
const TOKEN = 'vctrl_N3wIdPytooD26cwRCsRqm8zMZrLrjXWG'

/**
 * Exactly 32 bytes once decoded, which is the documented production format.
 *
 * The first version of this file used a string that *looked* like a 32-byte key
 * and decoded to 35, so every test took the sha256 branch and the base64 branch
 * - the one real deployments use - was never executed at all.
 */
const BASE64_KEY = 'ZW1iZWQtdG9rZW4ta2V5LTMyLWJ5dGVzLXh4eHh4eHg='

/** A second real 32-byte key, so a rotation test changes keys and not branches. */
const OTHER_BASE64_KEY = 'YS1kaWZmZXJlbnQtZW1iZWQta2V5LTMyLWJ5dGVzISE='

/** Written once under `BASE64_KEY`; see "the stored format" below. */
const GOLDEN_ENVELOPE =
	'enc:v1:V6orp69r+N40NNqQ:w7ZfqmDmisMgXBHZj9qGxw==:Abxo9m6+O8u01debI2nMi+7UKBIYuLpJd54hOastk281tXmcGS8='

/**
 * Re-imported per test, to reset the "logged once" flag.
 *
 * The key itself is read from `process.env` on every call, so nothing about the
 * key is cached - an earlier version of this comment claimed otherwise, which
 * would have misled anyone who later added real caching into thinking the
 * rotation test below still covered it.
 */
async function loadCipher() {
	vi.resetModules()
	return import('../app/lib/security/embed-token-cipher.server')
}

/**
 * Encrypt, and fail loudly if the module declined to.
 *
 * `encryptEmbedToken` returns null when no key material is configured, which is
 * a real state these tests exercise deliberately elsewhere. A `!` here would
 * make an accidental fallback into that state look like a passing test.
 */
function envelopeOf(
	encrypt: (value: string) => string | null,
	token = TOKEN
): string {
	const envelope = encrypt(token)
	expect(envelope, 'the cipher had key material to work with').not.toBeNull()
	return envelope as string
}

const originalEnv = { ...process.env }

beforeEach(() => {
	process.env[KEY_ENV] = BASE64_KEY
	process.env.NODE_ENV = 'test'
	reportServerError.mockClear()
})

afterEach(() => {
	process.env = { ...originalEnv }
})

describe('the embed token round trip', () => {
	it('returns exactly what was stored', async () => {
		const { encryptEmbedToken, decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(encryptEmbedToken(TOKEN))).toBe(TOKEN)
	})

	it('does not store the token in the clear', async () => {
		/*
		  The point of the column. A `text` field that happened to contain the
		  token verbatim would pass every other test in this file.
		*/
		const { encryptEmbedToken } = await loadCipher()
		const envelope = envelopeOf(encryptEmbedToken)

		expect(envelope).not.toContain(TOKEN)
		expect(envelope).not.toContain('vctrl_')
		expect(envelope.startsWith('enc:v1:')).toBe(true)
	})

	it('never emits the same ciphertext twice for one value', async () => {
		/*
		  A fixed IV would make the column a lookup table: equal tokens would
		  produce equal ciphertext, so a dump would reveal which projects share a
		  key without decrypting anything.
		*/
		const { encryptEmbedToken } = await loadCipher()

		expect(encryptEmbedToken(TOKEN)).not.toBe(encryptEmbedToken(TOKEN))
	})
})

describe('what cannot be read comes back as nothing', () => {
	it('reports a row that predates the column', async () => {
		const { decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(null)).toBeNull()
	})

	it('refuses a tampered ciphertext rather than decrypting it', async () => {
		const { encryptEmbedToken, decryptEmbedToken } = await loadCipher()
		const [prefix, version, iv, tag, ciphertext] =
			envelopeOf(encryptEmbedToken).split(':')

		const flipped = Buffer.from(ciphertext, 'base64')
		flipped[0] ^= 0xff

		expect(
			decryptEmbedToken(
				[prefix, version, iv, tag, flipped.toString('base64')].join(':')
			)
		).toBeNull()
	})

	it('refuses a forged auth tag', async () => {
		const { encryptEmbedToken, decryptEmbedToken } = await loadCipher()
		const [prefix, version, iv, , ciphertext] =
			envelopeOf(encryptEmbedToken).split(':')

		expect(
			decryptEmbedToken(
				[
					prefix,
					version,
					iv,
					Buffer.alloc(16).toString('base64'),
					ciphertext
				].join(':')
			)
		).toBeNull()
	})

	it('refuses a value that is not an envelope at all', async () => {
		const { decryptEmbedToken } = await loadCipher()

		for (const value of ['', 'vctrl_plain', 'enc:v1:only:three', 'a:b:c:d:e']) {
			expect(decryptEmbedToken(value), value).toBeNull()
		}
	})

	it('reports a row written under key material that has since changed', async () => {
		/*
		  Rotating the deployment key does not corrupt anything, but it does make
		  every existing row unreadable. That has to degrade to the same "cannot be
		  shown" state as a legacy row - a throw here would take down the whole key
		  list, including the keys written under the new key.
		*/
		const first = await loadCipher()
		const envelope = first.encryptEmbedToken(TOKEN)

		// Positive control: without it, this passes just as happily when
		// encryption was already broken before the key ever changed.
		expect(first.decryptEmbedToken(envelope)).toBe(TOKEN)

		process.env[KEY_ENV] = OTHER_BASE64_KEY
		const second = await loadCipher()

		expect(second.decryptEmbedToken(envelope)).toBeNull()
	})
})

describe('key material', () => {
	it('stores nothing without a configured key in production, and says so', async () => {
		/*
		  Not a throw. This module hangs off `createApiKey`, so throwing here took
		  down every API key mint in the product - the dashboard's own form
		  included - because a display-only value could not be encrypted. Failing
		  closed on the *data* is what matters: nothing is written under a key
		  nobody configured, the caller is unharmed, and the row lands in the
		  same "cannot be shown" state the panel already renders.
		*/
		delete process.env[KEY_ENV]
		process.env.NODE_ENV = 'production'
		const { encryptEmbedToken } = await loadCipher()

		expect(encryptEmbedToken(TOKEN)).toBeNull()
		expect(reportedMessages()).toContainEqual(
			expect.stringContaining('is not set')
		)
	})

	it('reads nothing either, rather than reporting every row as legacy', async () => {
		/*
		  The distinction this keeps alive: a null from a row that never had a
		  value and a null from a deployment that cannot decrypt look identical
		  to the caller, so the log line is the only thing separating them. It has
		  to fire on the read path too.
		*/
		delete process.env[KEY_ENV]
		process.env.NODE_ENV = 'production'
		const { decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(GOLDEN_ENVELOPE)).toBeNull()
		expect(reportedMessages()).toContainEqual(expect.stringContaining(KEY_ENV))
	})

	it('falls back only outside production, so local dev needs no setup', async () => {
		/*
		  Announced as a warning, not an error. This is the documented local
		  default, and `pii-encryption.server.ts` emits the same sentence at the
		  same level - an error here puts a `[security]` failure in every local
		  boot and in whatever reads log level in production tooling.
		*/
		const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
		delete process.env[KEY_ENV]
		process.env.NODE_ENV = 'development'
		const { encryptEmbedToken, decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(envelopeOf(encryptEmbedToken))).toBe(TOKEN)
		expect(warned).toHaveBeenCalledWith(
			expect.stringContaining('development fallback key')
		)
		expect(reportServerError).not.toHaveBeenCalled()

		warned.mockRestore()
	})

	it('does not treat a non-canonical string as raw key bytes', async () => {
		/*
		  The round-trip half of the branch, which nothing else reaches: this key
		  is `BASE64_KEY` with its padding stripped, so it still decodes to 32
		  bytes but is not what `Buffer.from(...).toString('base64')` produces.

		  Without the round-trip check both spellings decode to the same 32 bytes
		  and derive the same AES key, so two operators who believe they
		  configured different secrets would silently share one. With it, this
		  takes the sha256 branch and lands somewhere else entirely - which is
		  what this asserts, by showing the padded key cannot read it.
		*/
		process.env[KEY_ENV] = BASE64_KEY.replace(/=+$/, '')
		const unpadded = await loadCipher()
		const envelope = envelopeOf(unpadded.encryptEmbedToken)

		process.env[KEY_ENV] = BASE64_KEY
		const padded = await loadCipher()

		expect(padded.decryptEmbedToken(envelope)).toBeNull()
	})

	it('logs each cause once, not once per call', async () => {
		/*
		  The dedupe itself, on the one cause a passing local boot reaches.
		  `does not let one cause silence the other`, further down, is what proves
		  the causes are independent; this proves the early return holds across
		  repeated calls - a per-request log line on a hot path is how a real
		  incident gets buried.
		*/
		const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
		delete process.env[KEY_ENV]
		process.env.NODE_ENV = 'development'
		const { encryptEmbedToken } = await loadCipher()

		encryptEmbedToken(TOKEN)
		encryptEmbedToken(TOKEN)
		encryptEmbedToken(TOKEN)

		expect(warned).toHaveBeenCalledTimes(1)

		warned.mockRestore()
	})

	it('accepts raw key material as well as base64', async () => {
		process.env[KEY_ENV] = 'a-passphrase-that-is-not-base64-encoded'
		const { encryptEmbedToken, decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(encryptEmbedToken(TOKEN))).toBe(TOKEN)
	})
})

describe('the stored format', () => {
	/*
	  A golden vector, and the only test here that does not round-trip through
	  the module.

	  Everything else encrypts and decrypts with the same code, so changing the
	  key derivation, the IV length or the algorithm keeps the whole file green
	  while making every row already in the database permanently unreadable -
	  which the schema comment says is unrecoverable. This envelope was produced
	  once, under `BASE64_KEY`, and pins the format on disk rather than the
	  module's agreement with itself.
	*/
	it('still reads an envelope written by an earlier build', async () => {
		process.env[KEY_ENV] = BASE64_KEY
		const { decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(GOLDEN_ENVELOPE)).toBe(TOKEN)
	})

	it('encrypts under the decoded bytes of a real 32-byte key', async () => {
		/*
		  Decrypted outside the module, with the key read straight off the env
		  var, so this fails if the module derives anything else - a sha256 of the
		  string included.

		  The earlier version of this test only showed that two different key
		  materials produce different keys, which stays true with the base64
		  branch deleted, so it passed while naming a branch it never reached.
		*/
		process.env[KEY_ENV] = BASE64_KEY
		const { encryptEmbedToken } = await loadCipher()
		const [, , iv, tag, ciphertext] = envelopeOf(encryptEmbedToken).split(':')

		const decipher = createDecipheriv(
			'aes-256-gcm',
			Buffer.from(BASE64_KEY, 'base64'),
			Buffer.from(iv, 'base64')
		)
		decipher.setAuthTag(Buffer.from(tag, 'base64'))

		expect(
			Buffer.concat([
				decipher.update(Buffer.from(ciphertext, 'base64')),
				decipher.final()
			]).toString('utf8')
		).toBe(TOKEN)
	})
})

describe('an envelope this module did not write', () => {
	it('refuses a version it does not know', async () => {
		/*
		  The case the catch-all cannot rescue, and the reason the prefix check
		  exists: five parts, a valid IV, a valid tag and valid ciphertext, so
		  every downstream call succeeds. Delete the guard and this decrypts.
		*/
		const { encryptEmbedToken, decryptEmbedToken } = await loadCipher()
		const [, , iv, tag, ciphertext] = envelopeOf(encryptEmbedToken).split(':')

		expect(
			decryptEmbedToken(['enc', 'v2', iv, tag, ciphertext].join(':'))
		).toBeNull()
	})
})

describe('a deployment whose key material changed', () => {
	it('says so once, instead of reporting every key as legacy', async () => {
		/*
		  The failure with no other signal. Rotating the deployment key leaves
		  every stored row undecryptable, and the caller sees exactly the null a
		  row that never had a value produces - so without a log line, an
		  operator watching the product sees keys quietly stop being shown and
		  nothing anywhere says why.
		*/
		process.env[KEY_ENV] = OTHER_BASE64_KEY
		const { decryptEmbedToken } = await loadCipher()

		expect(decryptEmbedToken(GOLDEN_ENVELOPE)).toBeNull()
		expect(reportedMessages()).toContainEqual(
			expect.stringContaining('could not be decrypted')
		)
	})

	it('does not let one cause silence the other', async () => {
		/*
		  A single "already logged" flag made these mutually exclusive for the
		  lifetime of the process, and a deployment that lost its key material
		  produces both - so whichever fired first hid the one an operator needed.
		*/
		delete process.env[KEY_ENV]
		process.env.NODE_ENV = 'production'
		const { decryptEmbedToken, encryptEmbedToken } = await loadCipher()

		encryptEmbedToken(TOKEN)
		process.env[KEY_ENV] = OTHER_BASE64_KEY
		decryptEmbedToken(GOLDEN_ENVELOPE)

		const messages = reportedMessages()

		expect(messages.some((m) => m.includes('is not set'))).toBe(true)
		expect(messages.some((m) => m.includes('could not be decrypted'))).toBe(
			true
		)
	})
})
