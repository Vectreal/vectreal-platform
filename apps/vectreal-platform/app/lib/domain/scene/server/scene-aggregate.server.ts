import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { sceneSettingsService } from './scene-settings-service.server'

import type {
	SceneAggregateResponse,
	SceneAssetBinaryDataMap,
	SceneAssetRecord,
	SceneAssetRefMap,
	SceneManifestResponse,
	SerializedSceneAssetDataMap
} from '../../../../types/api'

const GLTF_JSON_MIME_TYPE = 'model/gltf+json'

/** Maps asset rows to fetchable refs; thumbnail and glTF JSON are excluded. */
export function toAssetRefs(
	assets: SceneAssetRecord[],
	buildAssetUrl: (assetId: string) => string
): SceneAssetRefMap {
	const refs: SceneAssetRefMap = {}

	for (const asset of assets) {
		if (asset.name === SCENE_THUMBNAIL_FILENAME) continue
		if (asset.mimeType === GLTF_JSON_MIME_TYPE) continue

		refs[asset.id] = {
			url: buildAssetUrl(asset.id),
			fileName: asset.name,
			mimeType: asset.mimeType ?? 'application/octet-stream',
			byteSize: asset.fileSize ?? null
		}
	}

	return refs
}

export async function buildSceneManifest(
	sceneId: string,
	buildAssetUrl: (assetId: string) => string
): Promise<SceneManifestResponse> {
	const [sceneMetaResult, settingsResult, statsResult] =
		await Promise.allSettled([
			sceneSettingsService.getSceneMetadata(sceneId),
			sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId),
			sceneSettingsService.getSceneStats(sceneId)
		])

	if (settingsResult.status === 'rejected') {
		console.error('Failed to load scene manifest segment:', {
			sceneId,
			error: settingsResult.reason
		})
	}

	const sceneMeta =
		sceneMetaResult.status === 'fulfilled' ? sceneMetaResult.value : null
	const settingsData =
		settingsResult.status === 'fulfilled' ? settingsResult.value : null
	const stats = statsResult.status === 'fulfilled' ? statsResult.value : null

	if (!settingsData) {
		return {
			sceneId,
			meta: sceneMeta,
			stats,
			settings: null,
			gltfJson: null,
			assetRefs: null,
			assets: null,
			settingsUpdatedAt: null
		}
	}

	return {
		sceneId,
		meta: settingsData.meta ?? sceneMeta,
		stats,
		settings: settingsData.settings,
		gltfJson: settingsData.gltfJson ?? null,
		assetRefs: toAssetRefs(settingsData.assets ?? [], buildAssetUrl),
		assets: settingsData.assets ?? null,
		settingsUpdatedAt: settingsData.settingsUpdatedAt
			? settingsData.settingsUpdatedAt.toISOString()
			: null
	}
}

/**
 * Returns a weak ETag for the scene manifest based on the scene ID and the
 * timestamp of the last settings save. Returns null when no timestamp is
 * available so callers can skip caching headers entirely.
 */
export function buildSceneManifestEtag(
	sceneId: string,
	settingsUpdatedAt: string | null
): string | null {
	if (!settingsUpdatedAt) return null
	return `W/"scene-${sceneId}-${settingsUpdatedAt}"`
}

function serializeAssetData(
	assetData: SceneAssetBinaryDataMap | null
): SerializedSceneAssetDataMap {
	const serialized: SerializedSceneAssetDataMap = {}

	assetData?.forEach((value, key) => {
		serialized[key] = {
			data: Buffer.from(value.data).toString('base64'),
			mimeType: value.mimeType,
			fileName: value.fileName,
			encoding: 'base64'
		}
	})

	return serialized
}

export async function buildSceneAggregate(
	sceneId: string
): Promise<SceneAggregateResponse> {
	const [sceneMetaResult, settingsResult, statsResult] =
		await Promise.allSettled([
			sceneSettingsService.getSceneMetadata(sceneId),
			sceneSettingsService.getSceneSettingsWithAssets(sceneId),
			sceneSettingsService.getSceneStats(sceneId)
		])

	if (sceneMetaResult.status === 'rejected') {
		console.error('Failed to load scene metadata for aggregate:', {
			sceneId,
			error: sceneMetaResult.reason
		})
	}

	if (settingsResult.status === 'rejected') {
		console.error('Failed to load scene settings aggregate segment:', {
			sceneId,
			error: settingsResult.reason
		})
	}

	if (statsResult.status === 'rejected') {
		console.error('Failed to load scene stats for aggregate:', {
			sceneId,
			error: statsResult.reason
		})
	}

	const sceneMeta =
		sceneMetaResult.status === 'fulfilled' ? sceneMetaResult.value : null
	const settingsData =
		settingsResult.status === 'fulfilled' ? settingsResult.value : null
	const stats = statsResult.status === 'fulfilled' ? statsResult.value : null

	if (!settingsData) {
		return {
			sceneId,
			meta: sceneMeta,
			stats,
			settings: null,
			gltfJson: null,
			assetData: null,
			assets: null
		}
	}

	return {
		sceneId,
		meta: settingsData.meta ?? sceneMeta,
		stats,
		settings: settingsData.settings,
		gltfJson: settingsData.gltfJson ?? null,
		assetData: serializeAssetData(settingsData.assetDataMap),
		assets: settingsData.assets ?? null
	}
}
