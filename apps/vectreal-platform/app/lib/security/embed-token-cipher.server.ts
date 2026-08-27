import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes
} from 'node:crypto'

import { reportServerError } from '../observability/report-server-error.server'

/**
 * Two-way storage for the embed preview token.
 *
 * The token this protects is public by construction: `buildEmbedUrl` puts it in
 * an `iframe src` on the customer's own page, where it is visible in view
 * source, in devtools and in that site's access logs. It is a domain-scoped
 * identifier, not a secret, and the allowed-domain list is the control that
 * actually restricts it.
 *
 * It was nevertheless stored only as a SHA-256 hash, which meant the product
 * could never show an owner a key they already had. The panel asked them to
 * paste one back - a value the system had refused to give them - and offered a
 * picker beside it that could not fill it in. Keeping a decryptable copy is what
 * makes "pick the key you already made" possible at all.
 *
 * `hashedKey` is untouched and remains the lookup and validation path in
 * `preview-api-key-auth.server.ts`. This is a second representation for display,
 * never for authentication: nothing here is on the request path of an embed.
 *
 * Deliberately not `pii-encryption.server.ts`. That module is encrypt-only by
 * design, because contact submissions are written and never read back, and it
 * falls back to `CSRF_SECRET` in production. Neither property is wanted here:
 * this needs a decrypt path, and it must not couple an embed token's lifetime to
 * the session secret, whose rotation would silently strip every stored value.
 * The duplicated AES envelope is the price; unifying the two is worth doing when
 * a third caller appears, not as a rider on a schema change.
 *
 * Both entry points return null rather than throwing. See `getAesKey`: this is
 * display-only storage hanging off the critical path that mints API keys, and it
 * must never be the reason a key cannot be created.
 */

const ENCRYPTION_PREFIX = 'enc:v1'
const ENCRYPTION_KEY_ENV = 'EMBED_TOKEN_ENCRYPTION_KEY'
const DEVELOPMENT_FALLBACK_KEY = 'vectreal-dev-embed-token-fallback-key'

/**
 * One line per cause, not one line per process.
 *
 * A single flag let whichever cause happened first silence the others for the
 * lifetime of the process - and the two failures are the ones most likely to
 * overlap, since a deployment that lost its key material produces both. Keyed
 * by cause, each still logs once, and none hides another.
 *
 * The level is a parameter because one of the three is not a problem: falling
 * back to a development key is the documented local default, and
 * `pii-encryption.server.ts` emits the same sentence at `warn`. Logging it as
 * an error puts a `[security]` error in every local boot and in any tracker
 * that reads level.
 *
 * `error` means `reportServerError`, which is the one path a server module may
 * report a swallowed failure through, and which logs as well as reports. This
 * used to be `console[level]`, which `no-console` forbids here: a `.server.ts`
 * module does not get to invent its own reporting.
 */
const loggedCauses = new Set<string>()

function logKeyNoticeOnce(
	cause: string,
	level: 'warn' | 'error',
	message: string
): void {
	if (loggedCauses.has(cause)) return
	loggedCauses.add(cause)

	if (level === 'error') {
		reportServerError(new Error(`[security] ${message}`))
		return
	}

	console.warn(`[security] ${message}`)
}

/**
 * The AES key, or null when this deployment cannot produce one.
 *
 * Null rather than a throw, and that is the whole design of this module.
 *
 * The first version threw in production when the key was unset, which read as
 * correct - fail closed rather than encrypt with something nobody chose - but
 * `createApiKey` calls this unconditionally, so an unset variable took down
 * every API key mint and rotation in the product, including the dashboard's own
 * form, for a value that is display-only. A feature that shows you a key must
 * not be able to stop you making one.
 *
 * Failing closed is preserved where it matters: nothing is written under a key
 * nobody configured. It is the *caller* that is spared, not the data - a null
 * here stores no value, which is a state the panel already renders as "rotate
 * to use".
 *
 * Every way this can go wrong logs once each, because all of them surface to a
 * user as the same silent "cannot be shown": the variable unset, here, and
 * material that changed under existing rows, from the decrypt path below.
 * Without the second, a rotated deployment key turns every key in the product
 * unreadable with no operational signal at all.
 */
function getAesKey(): Buffer | null {
	const configured = process.env[ENCRYPTION_KEY_ENV]
	if (configured && configured.trim().length > 0) {
		return deriveAesKey(configured.trim())
	}

	if (process.env.NODE_ENV === 'production') {
		logKeyNoticeOnce(
			'unset',
			'error',
			`${ENCRYPTION_KEY_ENV} is not set. Embed tokens are not being stored, so keys minted now can never be shown again and must be rotated once it is configured.`
		)
		return null
	}

	logKeyNoticeOnce(
		'fallback',
		'warn',
		`${ENCRYPTION_KEY_ENV} is not set. Using a development fallback key.`
	)

	return deriveAesKey(DEVELOPMENT_FALLBACK_KEY)
}

function deriveAesKey(keyMaterial: string): Buffer {
	/*
	  Round-tripped, not just length-checked. `Buffer.from(x, 'base64')` skips
	  characters outside the alphabet instead of failing, so a passphrase that
	  happens to contain 43 usable characters would silently be read as raw key
	  bytes - and two different passphrases could collide onto one AES key with
	  nothing to show for it.
	*/
	const decoded = Buffer.from(keyMaterial, 'base64')
	if (decoded.length === 32 && decoded.toString('base64') === keyMaterial) {
		return decoded
	}

	return createHash('sha256').update(keyMaterial).digest()
}

/** `enc:v1:<iv-base64>:<tag-base64>:<ciphertext-base64>` */
export function encryptEmbedToken(plaintext: string): string | null {
	const key = getAesKey()
	if (!key) {
		return null
	}

	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', key, iv)
	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf8'),
		cipher.final()
	])

	return [
		ENCRYPTION_PREFIX,
		iv.toString('base64'),
		cipher.getAuthTag().toString('base64'),
		encrypted.toString('base64')
	].join(':')
}

/**
 * The stored token, or null when this row cannot produce one.
 *
 * Null rather than a throw, for three cases that are all the same to a caller:
 * a row written before this column existed, a row encrypted under key material
 * that has since changed, and a row whose ciphertext no longer authenticates.
 * Every one of them means "this key cannot be shown", which the panel already
 * has to render - and throwing would take down the whole key list, including the
 * keys that are fine, for one unreadable row.
 *
 * The GCM auth tag is what makes that safe: a tampered ciphertext fails here
 * rather than decrypting to something an attacker chose.
 */
export function decryptEmbedToken(envelope: string | null): string | null {
	if (!envelope) {
		return null
	}

	const parts = envelope.split(':')
	if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== ENCRYPTION_PREFIX) {
		return null
	}

	/*
	  Resolved before the try, because a missing key is a deployment problem and
	  not a bad row, and routing it through the exception path would report it as
	  one. The `catch` below is for ciphertext that does not authenticate; this
	  never reaches it.
	*/
	const key = getAesKey()
	if (!key) {
		return null
	}

	const [, , iv, tag, ciphertext] = parts

	try {
		const decipher = createDecipheriv(
			'aes-256-gcm',
			key,
			Buffer.from(iv, 'base64')
		)
		decipher.setAuthTag(Buffer.from(tag, 'base64'))

		return Buffer.concat([
			decipher.update(Buffer.from(ciphertext, 'base64')),
			decipher.final()
		]).toString('utf8')
	} catch {
		/*
		  Either the ciphertext was tampered with or the key material changed
		  under a row that was written with a different one. The second is the
		  likely one and the dangerous one - it makes every existing key
		  unreadable at once - and neither is visible anywhere else, since the
		  caller only sees the same null a legacy row produces.
		*/
		logKeyNoticeOnce(
			'undecryptable',
			'error',
			`An embed token could not be decrypted. If ${ENCRYPTION_KEY_ENV} was changed, every key stored under the previous value is now unreadable and must be rotated.`
		)

		return null
	}
}
