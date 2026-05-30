import { buildAssetLookupKeys, normalizeAssetUri } from '@vctrl/core'

import type { SerializedSceneAssetDataMap, ServerSceneData } from '@vctrl/core'

const safeNormalizeAssetUri = (value: string): string => {
	try {
		return normalizeAssetUri(value)
	} catch {
		return value
	}
}

export const collectReferencedUris = (gltfJson: unknown): Set<string> => {
	const referencedUris = new Set<string>()
	const document = gltfJson as {
		images?: Array<{ uri?: string }>
		buffers?: Array<{ uri?: string }>
	}

	const images = Array.isArray(document.images) ? document.images : []
	for (const image of images) {
		if (typeof image.uri === 'string' && !image.uri.startsWith('data:')) {
			referencedUris.add(image.uri)
		}
	}

	const buffers = Array.isArray(document.buffers) ? document.buffers : []
	for (const buffer of buffers) {
		if (typeof buffer.uri === 'string' && !buffer.uri.startsWith('data:')) {
			referencedUris.add(buffer.uri)
		}
	}

	return referencedUris
}

export const buildSceneDataFromLocalFiles = async (
	gltfFile: File,
	assetFiles: File[]
): Promise<ServerSceneData> => {
	const gltfJson = JSON.parse(
		await gltfFile.text()
	) as ServerSceneData['gltfJson']
	const referencedUris = collectReferencedUris(gltfJson)
	const assetData: SerializedSceneAssetDataMap = {}
	const fileLookup = new Map<string, File>()
	const fileBytesCache = new Map<File, Uint8Array>()
	const matchedFiles = new Set<File>()

	const getFileBytes = async (file: File): Promise<Uint8Array> => {
		const cached = fileBytesCache.get(file)
		if (cached) return cached
		const bytes = new Uint8Array(await file.arrayBuffer())
		fileBytesCache.set(file, bytes)
		return bytes
	}

	for (const assetFile of assetFiles) {
		for (const key of buildAssetLookupKeys(assetFile.name)) {
			fileLookup.set(key, assetFile)
		}
		if (assetFile.webkitRelativePath) {
			for (const key of buildAssetLookupKeys(assetFile.webkitRelativePath)) {
				fileLookup.set(key, assetFile)
			}
		}
	}

	const missingUris: string[] = []

	for (const uri of referencedUris) {
		const normalizedUri = safeNormalizeAssetUri(uri)
		const basename = normalizedUri.split('/').pop() || normalizedUri

		const matchedFile =
			fileLookup.get(uri) ||
			fileLookup.get(normalizedUri) ||
			fileLookup.get(basename)

		if (!matchedFile) {
			missingUris.push(uri)
			continue
		}

		matchedFiles.add(matchedFile)
		const bytes = await getFileBytes(matchedFile)
		assetData[normalizedUri] = {
			data: Array.from(bytes),
			fileName: normalizedUri,
			mimeType: matchedFile.type || 'application/octet-stream'
		}
	}

	if (missingUris.length > 0) {
		throw new Error(
			`Scene payload is missing required referenced assets: ${missingUris.slice(0, 5).join(', ')}`
		)
	}

	for (const [index, assetFile] of assetFiles.entries()) {
		if (matchedFiles.has(assetFile)) continue

		const normalizedName = safeNormalizeAssetUri(assetFile.name)
		const basename = normalizedName.split('/').pop() || normalizedName
		const bytes = await getFileBytes(assetFile)
		assetData[`extra-${index}-${basename}`] = {
			data: Array.from(bytes),
			fileName: basename,
			mimeType: assetFile.type || 'application/octet-stream'
		}
	}

	return { gltfJson, assetData }
}
