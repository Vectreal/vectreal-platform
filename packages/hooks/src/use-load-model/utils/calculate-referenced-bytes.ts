import {
	buildAssetLookupKeys,
	getSerializedAssetByteSize,
	normalizeAssetUri
} from '@vctrl/core'

import type { ServerSceneData } from '../types'

type ReferencedBytes = {
	sourcePackageBytes: number
	textureBytes: number
}

const resolveSizeFromAssets = (
	uri: string,
	assets: Array<{ fileName: string; size: number }>
) => {
	const normalizedUri = normalizeAssetUri(uri)
	const uriBasename = normalizedUri.split('/').pop() || normalizedUri

	for (const asset of assets) {
		const assetKeys = buildAssetLookupKeys(asset.fileName)
		if (assetKeys.has(normalizedUri) || assetKeys.has(uriBasename)) {
			return asset.size
		}
	}

	return 0
}

const collectReferencedUris = (gltfJson: unknown) => {
	const bufferUris = new Set<string>()
	const imageUris = new Set<string>()
	const document = gltfJson as {
		images?: Array<{ uri?: string }>
		buffers?: Array<{ uri?: string }>
	}

	const images = Array.isArray(document.images)
		? (document.images as Array<{ uri?: string }>)
		: []
	for (const image of images) {
		if (typeof image.uri === 'string' && !image.uri.startsWith('data:')) {
			imageUris.add(image.uri)
		}
	}

	const buffers = Array.isArray(document.buffers)
		? (document.buffers as Array<{ uri?: string }>)
		: []
	for (const buffer of buffers) {
		if (typeof buffer.uri === 'string' && !buffer.uri.startsWith('data:')) {
			bufferUris.add(buffer.uri)
		}
	}

	return { bufferUris, imageUris }
}

export async function calculateReferencedBytesFromFiles(
	gltfFile: File,
	assetFiles: File[]
): Promise<ReferencedBytes> {
	const gltfText = await gltfFile.text()
	let gltfJson: Record<string, unknown>

	try {
		gltfJson = JSON.parse(gltfText) as Record<string, unknown>
	} catch {
		return {
			sourcePackageBytes: gltfFile.size,
			textureBytes: 0
		}
	}

	const assets = assetFiles.map((file) => ({
		fileName: file.name,
		size: file.size
	}))

	const { bufferUris, imageUris } = collectReferencedUris(gltfJson)

	const bufferBytes = Array.from(bufferUris).reduce(
		(total, uri) => total + resolveSizeFromAssets(uri, assets),
		0
	)
	const textureBytes = Array.from(imageUris).reduce(
		(total, uri) => total + resolveSizeFromAssets(uri, assets),
		0
	)

	return {
		sourcePackageBytes: gltfFile.size + bufferBytes + textureBytes,
		textureBytes
	}
}

export function calculateReferencedBytesFromServerScene(
	data: ServerSceneData
): ReferencedBytes {
	const gltfJson = data.gltfJson
	const assets = Object.values(data.assetData || {}).map((asset) => ({
		fileName: asset.fileName,
		size: getSerializedAssetByteSize(asset.data)
	}))

	const gltfSize = new TextEncoder().encode(JSON.stringify(gltfJson)).byteLength
	const { bufferUris, imageUris } = collectReferencedUris(gltfJson)

	const bufferBytes = Array.from(bufferUris).reduce(
		(total, uri) => total + resolveSizeFromAssets(uri, assets),
		0
	)
	const textureBytes = Array.from(imageUris).reduce(
		(total, uri) => total + resolveSizeFromAssets(uri, assets),
		0
	)

	return {
		sourcePackageBytes: gltfSize + bufferBytes + textureBytes,
		textureBytes
	}
}
