import { buildAssetLookupKeys } from '@vctrl/core'

import type { SceneManifestResponse } from '../../../../types/api'

interface ManifestReferencedBytes {
	sourcePackageBytes: null | number
	textureBytes: null | number
}

const extractGltfDocument = (
	value: unknown
): {
	images?: Array<{ uri?: unknown }>
	buffers?: Array<{ uri?: unknown }>
} | null => {
	if (!value || typeof value !== 'object') {
		return null
	}

	const candidate = value as {
		images?: unknown
		buffers?: unknown
		json?: unknown
	}

	if (Array.isArray(candidate.images) || Array.isArray(candidate.buffers)) {
		return candidate as {
			images?: Array<{ uri?: unknown }>
			buffers?: Array<{ uri?: unknown }>
		}
	}

	if (candidate.json && typeof candidate.json === 'object') {
		const nested = candidate.json as {
			images?: unknown
			buffers?: unknown
		}

		if (Array.isArray(nested.images) || Array.isArray(nested.buffers)) {
			return nested as {
				images?: Array<{ uri?: unknown }>
				buffers?: Array<{ uri?: unknown }>
			}
		}
	}

	return null
}

/**
 * Byte totals for a saved scene, read from the manifest's asset references.
 *
 * The references carry their own sizes, so the size bar is accurate before a
 * single asset has been downloaded.
 */
export const calculateManifestReferencedBytes = (
	manifest: SceneManifestResponse | null
): ManifestReferencedBytes => {
	const gltfJson = manifest?.gltfJson
	if (!gltfJson) {
		return {
			sourcePackageBytes: null,
			textureBytes: null
		}
	}

	const assets = Object.values(manifest?.assetRefs ?? {}).map((asset) => ({
		fileName: asset.fileName,
		size: asset.byteSize ?? 0
	}))

	const resolveAssetSize = (uri: string) => {
		const uriKeys = buildAssetLookupKeys(uri)

		for (const asset of assets) {
			const assetKeys = buildAssetLookupKeys(asset.fileName)
			for (const key of uriKeys) {
				if (assetKeys.has(key)) {
					return asset.size
				}
			}
		}

		return 0
	}

	const imageUris = new Set<string>()
	const bufferUris = new Set<string>()

	const gltfDocument = extractGltfDocument(gltfJson)

	const images = Array.isArray(gltfDocument?.images) ? gltfDocument.images : []
	for (const image of images) {
		if (typeof image.uri === 'string' && !image.uri.startsWith('data:')) {
			imageUris.add(image.uri)
		}
	}

	const buffers = Array.isArray(gltfDocument?.buffers)
		? gltfDocument.buffers
		: []
	for (const buffer of buffers) {
		if (typeof buffer.uri === 'string' && !buffer.uri.startsWith('data:')) {
			bufferUris.add(buffer.uri)
		}
	}

	const textureBytes = Array.from(imageUris).reduce(
		(total, uri) => total + resolveAssetSize(uri),
		0
	)
	const bufferBytes = Array.from(bufferUris).reduce(
		(total, uri) => total + resolveAssetSize(uri),
		0
	)
	const gltfBytes = new TextEncoder().encode(
		JSON.stringify(gltfDocument ?? gltfJson)
	).byteLength

	return {
		sourcePackageBytes: gltfBytes + bufferBytes + textureBytes,
		textureBytes
	}
}
