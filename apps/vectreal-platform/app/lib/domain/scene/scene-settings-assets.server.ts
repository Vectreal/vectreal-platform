import { SerializedAsset } from '@vctrl/core'
import { ExtendedGLTFDocument } from '@vctrl/hooks/use-load-model/types'

import {
	computeAssetHash,
	type GLTFAssetData
} from '../asset/asset-storage.server'

import type { GLTFExportResult } from '../../../types/api'
import type { JSONDocument } from '@gltf-transform/core'

type GltfAssetKind = 'buffer' | 'image'

type GltfAssetMeta = {
	mimeType: string
	type: GltfAssetKind
}

export function isGltfExportResult(
	gltfJson: JSONDocument | GLTFExportResult
): gltfJson is GLTFExportResult {
	return (
		typeof gltfJson === 'object' &&
		gltfJson !== null &&
		'format' in gltfJson &&
		gltfJson.format === 'gltf'
	)
}

function resolveGltfAssetMeta(fileName: string): GltfAssetMeta {
	const extension = fileName.split('.').pop()?.toLowerCase()

	if (extension === 'bin') {
		return { mimeType: 'application/octet-stream', type: 'buffer' }
	}

	if (extension === 'png') {
		return { mimeType: 'image/png', type: 'image' }
	}

	if (extension === 'jpg' || extension === 'jpeg') {
		return { mimeType: 'image/jpeg', type: 'image' }
	}

	if (extension === 'webp') {
		return { mimeType: 'image/webp', type: 'image' }
	}

	return { mimeType: 'application/octet-stream', type: 'buffer' }
}

export function extractGltfAssets(
	gltfExportResult: GLTFExportResult
): GLTFAssetData[] {
	const extractedAssets: GLTFAssetData[] = []

	if (!isGltfExportResult(gltfExportResult) || !gltfExportResult.assets) {
		console.warn('No assets found in GLTF export result')
		return extractedAssets
	}

	if (gltfExportResult.assets instanceof Map) {
		gltfExportResult.assets.forEach((data: Uint8Array, fileName: string) => {
			const meta = resolveGltfAssetMeta(fileName)

			extractedAssets.push({
				fileName,
				data,
				mimeType: meta.mimeType,
				type: meta.type
			})
		})
	} else if (Array.isArray(gltfExportResult.assets)) {
		gltfExportResult.assets.forEach((asset: SerializedAsset) => {
			const meta = resolveGltfAssetMeta(asset.fileName)
			const data = new Uint8Array(asset.data)

			extractedAssets.push({
				fileName: asset.fileName,
				data,
				mimeType: meta.mimeType,
				type: meta.type
			})
		})
	}

	return extractedAssets
}

export function buildGltfJsonAsset(
	gltfExportResult: GLTFExportResult
): GLTFAssetData {
	const gltfJsonData = JSON.stringify(gltfExportResult.data)

	return {
		fileName: 'scene.gltf',
		data: new TextEncoder().encode(gltfJsonData),
		mimeType: 'model/gltf+json',
		type: 'buffer'
	}
}

export function buildExtendedGltfDocument(params: {
	baseDocument: ExtendedGLTFDocument
	assetIds: string[]
}): ExtendedGLTFDocument {
	const { baseDocument, assetIds } = params

	return {
		...baseDocument,
		assetIds,
		asset: {
			...baseDocument.asset,
			extensions: {
				...baseDocument.asset?.extensions,
				VECTREAL_asset_metadata: {
					assetIds
				}
			}
		}
	}
}

export function extractAssetIdsFromGltf(
	gltfJson: ExtendedGLTFDocument
): string[] {
	const assetIds: string[] = []

	if (gltfJson.asset?.extensions) {
		const extensions = gltfJson.asset.extensions
		if (extensions.VECTREAL_asset_metadata?.assetIds) {
			assetIds.push(...extensions.VECTREAL_asset_metadata.assetIds)
		}
	}

	if (gltfJson.assetIds && Array.isArray(gltfJson.assetIds)) {
		assetIds.push(...gltfJson.assetIds)
	}

	return assetIds
}

export function computeAssetHashes(
	assets: GLTFAssetData[]
): Map<string, string> {
	return assets.reduce((hashes, asset) => {
		hashes.set(asset.fileName, computeAssetHash(asset.data))
		return hashes
	}, new Map<string, string>())
}

export function compareAssetIds(
	currentIds: string[],
	existingIds: string[]
): boolean {
	if (currentIds.length !== existingIds.length) return true

	const sortedCurrent = [...currentIds].sort()
	const sortedExisting = [...existingIds].sort()

	return sortedCurrent.some((id, index) => id !== sortedExisting[index])
}

export function compareAssetHashes(
	currentHashes: Map<string, string>,
	existingHashes: Map<string, string>
): boolean {
	if (currentHashes.size !== existingHashes.size) return true

	for (const [fileName, currentHash] of currentHashes) {
		const existingHash = existingHashes.get(fileName)
		if (!existingHash || existingHash !== currentHash) {
			return true
		}
	}

	return false
}
