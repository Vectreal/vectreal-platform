import { serializeSceneAssetData } from './scene-draft-serialization'
import { savePendingSceneDraft } from '../../../persistence/pending-scene-idb'

import type { SceneMetaState } from '../../../../types/publisher-config'
import type { Optimizations, SceneSettings, ServerSceneData } from '@vctrl/core'



interface PersistPendingSceneDraftParams {
	modelAvailable: boolean
	prepareGltfDocumentForUpload: () => Promise<unknown>
	sceneMetaState: SceneMetaState
	currentSettings: SceneSettings
	optimizationSettings: Optimizations | null
}

export const persistPendingSceneDraftOrchestrator = async ({
	modelAvailable,
	prepareGltfDocumentForUpload,
	sceneMetaState,
	currentSettings,
	optimizationSettings
}: PersistPendingSceneDraftParams): Promise<boolean> => {
	if (!modelAvailable) {
		return false
	}

	const gltfJsonToSend = await prepareGltfDocumentForUpload()
	if (!gltfJsonToSend) {
		return false
	}

	const gltfData = (gltfJsonToSend as { data?: unknown }).data ?? gltfJsonToSend
	const gltfAssets = (gltfJsonToSend as { assets?: unknown }).assets
	const assetData = await serializeSceneAssetData(gltfData, gltfAssets)

	const sceneData: ServerSceneData = {
		meta: {
			name: sceneMetaState.name,
			description: sceneMetaState.description,
			thumbnailUrl: sceneMetaState.thumbnailUrl
		},
		gltfJson: gltfData as ServerSceneData['gltfJson'],
		assetData,
		bounds: currentSettings.bounds,
		environment: currentSettings.environment,
		camera: currentSettings.camera,
		controls: currentSettings.controls,
		shadows: currentSettings.shadows
	}

	return savePendingSceneDraft({
		sceneMeta: sceneMetaState,
		sceneData,
		optimizationSettings
	})
}
