import type { SceneAssetDataEntry } from '../types'

export const normalizeAssetUri = (value: string): string =>
	decodeURIComponent(value).replace(/^\.\//, '')

export const buildAssetLookupKeys = (fileName: string): Set<string> => {
	const normalized = normalizeAssetUri(fileName)
	const basename = normalized.split('/').pop() || normalized

	return new Set([fileName, normalized, basename])
}

export const resolveMimeTypeFromFileName = (fileName: string): string => {
	const lower = fileName.toLowerCase()
	if (lower.endsWith('.webp')) return 'image/webp'
	if (lower.endsWith('.png')) return 'image/png'
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
	if (lower.endsWith('.gltf')) return 'model/gltf+json'
	if (lower.endsWith('.bin')) return 'application/octet-stream'
	return 'application/octet-stream'
}

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

export const getAssetKindFromMimeType = (
	mimeType: string
): 'buffer' | 'image' =>
	mimeType.startsWith('image/') ? 'image' : 'buffer'

export function getSerializedAssetByteSize(assetData: number[] | string): number {
	if (Array.isArray(assetData)) {
		return assetData.length
	}

	const normalized = assetData.replace(/\s/g, '')
	const paddingMatch = normalized.match(/=+$/)
	const paddingLength = paddingMatch ? paddingMatch[0].length : 0

	return Math.max(0, Math.floor((normalized.length * 3) / 4) - paddingLength)
}

export const isValidBase64 = (value: string): boolean => {
	const normalized = value.replace(/\s/g, '')

	if (normalized.length === 0 || normalized.length % 4 !== 0) {
		return false
	}

	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
		return false
	}

	const firstPaddingIndex = normalized.indexOf('=')
	if (firstPaddingIndex !== -1) {
		const trailing = normalized.slice(firstPaddingIndex)
		if (!/^={1,2}$/.test(trailing)) {
			return false
		}
	}

	return true
}

export function decodeBase64ToUint8Array(base64: string): Uint8Array {
	if (typeof atob !== 'function') {
		throw new Error('Base64 decoding is not supported in this environment')
	}

	const normalized = base64.replace(/\s/g, '')
	const binaryString = atob(normalized)
	const bytes = new Uint8Array(binaryString.length)

	for (let index = 0; index < binaryString.length; index += 1) {
		bytes[index] = binaryString.charCodeAt(index)
	}

	return bytes
}

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