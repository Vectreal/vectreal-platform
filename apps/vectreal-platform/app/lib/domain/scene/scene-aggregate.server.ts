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
			data: Array.from(value.data),
			mimeType: value.mimeType,
			fileName: value.fileName
		}
	})

	return serialized
}

export async function buildSceneAggregate(
	sceneId: string
): Promise<SceneAggregateResponse> {
	const [settingsResult, stats] = await Promise.all([
		sceneSettingsService.getSceneSettingsWithAssets(sceneId),
		sceneSettingsService.getSceneStats(sceneId)
	])

	if (!settingsResult) {
		return {
			sceneId,
			stats,
			settings: null,
			gltfJson: null,
			assetData: null,
			assets: null
		}
	}

	return {
		sceneId,
		stats,
		settings: {
			environment: settingsResult.environment ?? undefined,
			controls: settingsResult.controls ?? undefined,
			shadows: settingsResult.shadows ?? undefined,
			meta: settingsResult.meta ?? undefined
		},
		gltfJson: settingsResult.gltfJson ?? null,
		assetData: serializeAssetData(settingsResult.assetDataMap),
		assets: settingsResult.assets ?? null
	}
}
