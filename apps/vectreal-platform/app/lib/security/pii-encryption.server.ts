import { createCipheriv, createHash, randomBytes } from 'node:crypto'

const ENCRYPTION_PREFIX = 'enc:v1'
const ENCRYPTION_KEY_ENV = 'CONTACT_DATA_ENCRYPTION_KEY'
const FALLBACK_PRODUCTION_KEY_ENV = 'CSRF_SECRET'

let warnedAboutFallbackKey = false

function getRawKeyMaterial(): string {
	const configuredKey = process.env[ENCRYPTION_KEY_ENV]
	if (configuredKey && configuredKey.trim().length > 0) {
		return configuredKey.trim()
	}

	if (process.env.NODE_ENV === 'production') {
		const fallbackProductionKey = process.env[FALLBACK_PRODUCTION_KEY_ENV]
		if (fallbackProductionKey && fallbackProductionKey.trim().length > 0) {
			if (!warnedAboutFallbackKey) {
				warnedAboutFallbackKey = true
				console.warn(
					`[security] ${ENCRYPTION_KEY_ENV} is not set. Falling back to ${FALLBACK_PRODUCTION_KEY_ENV} for backward-compatible contact encryption key derivation.`
				)
			}
			return fallbackProductionKey.trim()
		}

		throw new Error(
			`Missing ${ENCRYPTION_KEY_ENV}. Contact form PII encryption cannot run without a configured key.`
		)
	}

	if (!warnedAboutFallbackKey) {
		warnedAboutFallbackKey = true
		console.warn(
			`[security] ${ENCRYPTION_KEY_ENV} is not set. Using a development fallback key.`
		)
	}

	return 'vectreal-dev-contact-fallback-key'
}

function deriveAesKey(): Buffer {
	const keyMaterial = getRawKeyMaterial()

	try {
		const decoded = Buffer.from(keyMaterial, 'base64')
		if (decoded.length === 32) {
			return decoded
		}
	} catch {
		// Fall back to SHA-256 derivation for non-base64 key material.
	}

	return createHash('sha256').update(keyMaterial).digest()
}

/**
 * Encrypts sensitive contact payloads before persisting to the database.
 * Output format: enc:v1:<iv-base64>:<tag-base64>:<ciphertext-base64>
 */
export function encryptSensitiveValue(plaintext: string): string {
	const key = deriveAesKey()
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', key, iv)
	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf8'),
		cipher.final()
	])
	const tag = cipher.getAuthTag()

	return [
		ENCRYPTION_PREFIX,
		iv.toString('base64'),
		tag.toString('base64'),
		encrypted.toString('base64')
	].join(':')
}
