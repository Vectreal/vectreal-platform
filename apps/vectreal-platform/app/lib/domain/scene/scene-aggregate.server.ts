import { sceneSettingsService } from './scene-settings-service.server'

import type {
	SceneAggregateResponse,
	SceneAssetDataMap,
	SerializedSceneAssetDataMap
} from '../../../types/api'

function serializeAssetData(
	assetData: SceneAssetDataMap | null
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
