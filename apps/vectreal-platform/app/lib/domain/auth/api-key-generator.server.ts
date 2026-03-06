import { randomBytes } from 'node:crypto'

import { hashApiToken } from './preview-api-key-auth.server'

// Base62 character set (alphanumeric without ambiguous characters)
const BASE62_CHARS =
	'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Generate a random base62 string from secure random bytes
 */
function generateBase62String(byteLength: number): string {
	const base = BASE62_CHARS.length
	const limit = Math.floor(256 / base) * base // largest multiple of base <= 256
	let result = ''

	let bytes = randomBytes(byteLength)
	let index = 0

	while (result.length < byteLength) {
		if (index >= bytes.length) {
			// Need more random data; generate another batch
			bytes = randomBytes(byteLength)
			index = 0
		}

		const byte = bytes[index++]

		// Rejection sampling to avoid modulo bias
		if (byte >= limit) {
			continue
		}

		result += BASE62_CHARS[byte % base]
	}

	return result
}

/**
 * Generate a new API key with vctrl_ prefix
 * @returns Object with plaintext key, hashed key, and preview (last 4 chars)
 */
export function generateApiKey(): {
	plaintext: string
	hashed: string
	preview: string
} {
	// Generate 32 bytes of random data -> ~43 base62 characters
	const randomPart = generateBase62String(32)
	const plaintext = `vctrl_${randomPart}`

	// Hash the key for storage
	const hashed = hashApiToken(plaintext)

	// Extract last 4 characters for preview display
	const preview = plaintext.slice(-4)

	return {
		plaintext,
		hashed,
		preview
	}
}
