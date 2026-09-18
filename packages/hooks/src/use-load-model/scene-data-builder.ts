import { normalizeAssetUri } from '@vctrl/core'
import {
	missingAssetsError,
	referenceIn,
	selectionKey
} from '@vctrl/core/model-loader'

import type { SerializedSceneAssetDataMap, ServerSceneData } from '@vctrl/core'

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
	/*
	  The selection, keyed the one way `@vctrl/core` keys one: where each file
	  sat in what the visitor dropped. What this replaced was a lookup table
	  holding every spelling of every file, ending in the bare basename - so two
	  files called `diffuse.png` in sibling folders were one entry, and the
	  payload uploaded one image under both URIs while the viewer beside it
	  showed the right two.
	*/
	const selection = new Map<string, File>()
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
		selection.set(selectionKey(assetFile), assetFile)
	}

	const modelPath = selectionKey(gltfFile)
	const missingUris: string[] = []

	for (const uri of referencedUris) {
		/*
		  The lookup is in the dropped frame; the spelling written out below is
		  the server's. `assetData` is keyed by the normalized URI and each entry
		  names itself the same way, because that is what the upload manifest and
		  every reader of a saved scene expect.
		*/
		const normalizedUri = normalizeAssetUri(uri)
		const matchedFile = referenceIn(selection, uri, modelPath)

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
		throw missingAssetsError(
			`Scene payload is missing required referenced assets: ${missingUris.slice(0, 5).join(', ')}`
		)
	}

	for (const [index, assetFile] of assetFiles.entries()) {
		if (matchedFiles.has(assetFile)) continue

		const normalizedName = normalizeAssetUri(assetFile.name)
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
