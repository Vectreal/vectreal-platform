import type { SceneAssetDataEntry } from '../types'

export { normalizeCameraSettings } from './normalize-camera-settings'

/**
 * Normalizes a resource URI used in glTF references.
 *
 * - Decodes URL-encoded characters (e.g. `%20` -> space).
 * - Removes a leading `./` so lookups can match both forms.
 */
export const normalizeAssetUri = (value: string): string =>
	decodeURIComponent(value).replace(/^\.\//, '')

/**
 * Builds equivalent lookup keys for a referenced asset path.
 *
 * This supports matching by:
 * - original incoming value
 * - normalized path
 * - basename only
 */
export const buildAssetLookupKeys = (fileName: string): Set<string> => {
	const normalized = normalizeAssetUri(fileName)
	const basename = normalized.split('/').pop() || normalized

	return new Set([fileName, normalized, basename])
}

/**
 * Resolves MIME type from file extension.
 *
 * Falls back to `application/octet-stream` for unknown extensions.
 */
export const resolveMimeTypeFromFileName = (fileName: string): string => {
	const lower = fileName.toLowerCase()
	if (lower.endsWith('.webp')) return 'image/webp'
	if (lower.endsWith('.png')) return 'image/png'
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
	if (lower.endsWith('.gltf')) return 'model/gltf+json'
	if (lower.endsWith('.bin')) return 'application/octet-stream'
	return 'application/octet-stream'
}

/**
 * Best-effort MIME detection from magic bytes.
 *
 * Returns `null` when signature is unknown or not enough bytes are available.
 */
export const detectMimeTypeFromBytes = (bytes: Uint8Array): string | null => {
	if (bytes.length >= 12) {
		const isPng =
			bytes[0] === 0x89 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x4e &&
			bytes[3] === 0x47 &&
			bytes[4] === 0x0d &&
			bytes[5] === 0x0a &&
			bytes[6] === 0x1a &&
			bytes[7] === 0x0a
		if (isPng) return 'image/png'

		const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
		if (isJpeg) return 'image/jpeg'

		const isWebp =
			bytes[0] === 0x52 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x46 &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x45 &&
			bytes[10] === 0x42 &&
			bytes[11] === 0x50
		if (isWebp) return 'image/webp'
	}

	return null
}

/** Maps MIME type to scene asset kind used by upload and storage flows. */
export const getAssetKindFromMimeType = (
	mimeType: string
): 'buffer' | 'image' => (mimeType.startsWith('image/') ? 'image' : 'buffer')

/** Checks for ASCII whitespace used in base64 payload normalization. */
const isAsciiWhitespace = (char: string): boolean =>
	char === ' ' ||
	char === '\n' ||
	char === '\r' ||
	char === '\t' ||
	char === '\f' ||
	char === '\v'

/**
 * Removes ASCII whitespace without regex to keep scanning strictly linear.
 */
const stripAsciiWhitespace = (value: string): string => {
	let normalized = ''

	for (let index = 0; index < value.length; index += 1) {
		const char = value[index]
		if (!isAsciiWhitespace(char)) {
			normalized += char
		}
	}

	return normalized
}

/** Validates whether a character belongs to the base64 alphabet. */
const isBase64AlphabetChar = (char: string): boolean => {
	const code = char.charCodeAt(0)

	const isUppercase = code >= 65 && code <= 90
	const isLowercase = code >= 97 && code <= 122
	const isDigit = code >= 48 && code <= 57
	const isPlus = code === 43
	const isSlash = code === 47

	return isUppercase || isLowercase || isDigit || isPlus || isSlash
}

/**
 * Estimates serialized byte size for either:
 * - raw numeric bytes (`number[]`) or
 * - base64 text payloads (`string`).
 *
 * For base64 input, this computes decoded length from normalized text length and
 * trailing `=` padding count, while tolerating ASCII whitespace.
 */
export function getSerializedAssetByteSize(
	assetData: number[] | string
): number {
	if (Array.isArray(assetData)) {
		return assetData.length
	}

	let normalizedLength = 0
	let trailingPaddingLength = 0
	let seenNonPaddingChar = false

	for (let index = assetData.length - 1; index >= 0; index -= 1) {
		const char = assetData[index]
		if (
			char === ' ' ||
			char === '\n' ||
			char === '\r' ||
			char === '\t' ||
			char === '\f' ||
			char === '\v'
		) {
			continue
		}

		normalizedLength += 1
		if (!seenNonPaddingChar && char === '=') {
			trailingPaddingLength += 1
			continue
		}

		seenNonPaddingChar = true
	}

	return Math.max(
		0,
		Math.floor((normalizedLength * 3) / 4) - trailingPaddingLength
	)
}

/**
 * Validates canonical base64 shape using linear character checks.
 *
 * Rules enforced:
 * - non-empty and length divisible by 4
 * - alphabet chars before padding
 * - optional trailing `=` padding, max 2 chars
 */
export const isValidBase64 = (value: string): boolean => {
	const normalized = stripAsciiWhitespace(value)

	if (normalized.length === 0 || normalized.length % 4 !== 0) {
		return false
	}

	let paddingCount = 0
	let reachedPadding = false

	for (let index = 0; index < normalized.length; index += 1) {
		const char = normalized[index]

		if (char === '=') {
			reachedPadding = true
			paddingCount += 1
			if (paddingCount > 2) {
				return false
			}
			continue
		}

		if (reachedPadding || !isBase64AlphabetChar(char)) {
			return false
		}
	}

	return true
}

/**
 * Decodes base64 payload into bytes.
 *
 * Throws when `atob` is unavailable in the runtime.
 */
export function decodeBase64ToUint8Array(base64: string): Uint8Array {
	if (typeof atob !== 'function') {
		throw new Error('Base64 decoding is not supported in this environment')
	}

	const normalized = stripAsciiWhitespace(base64)
	const binaryString = atob(normalized)
	const bytes = new Uint8Array(binaryString.length)

	for (let index = 0; index < binaryString.length; index += 1) {
		bytes[index] = binaryString.charCodeAt(index)
	}

	return bytes
}

/**
 * Converts serialized scene asset payload to raw bytes.
 *
 * - `number[]` is treated as explicit byte values.
 * - `encoding === 'base64'` is decoded from base64 text.
 * - otherwise input text is UTF-8 encoded.
 */
export function toSerializedAssetBytes(
	asset: Pick<SceneAssetDataEntry, 'data' | 'encoding'>
): Uint8Array {
	if (Array.isArray(asset.data)) {
		return Uint8Array.from(asset.data)
	}

	if (asset.encoding === 'base64') {
		return decodeBase64ToUint8Array(asset.data)
	}

	return new TextEncoder().encode(asset.data)
}
