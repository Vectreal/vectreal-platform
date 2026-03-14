import type { PendingSceneDraft } from '../../../../types/pending-scene'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type {
	OptimizationPreset,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'
import type {
	SceneDataLoadOptions,
	SceneLoadResult
} from '@vctrl/hooks/use-load-model'

interface ExecutePendingSceneDraftHydrationParams {
	draft: PendingSceneDraft
	inferOptimizationPreset: (optimizations: Optimizations) => OptimizationPreset
	setOptimizationState: (
		updater: (prev: OptimizationState) => OptimizationState
	) => void
	setOptimizationRuntime: (
		updater: (
			prev: SceneOptimizationRuntimeState
		) => SceneOptimizationRuntimeState
	) => void
	loadFromData: (params: SceneDataLoadOptions) => Promise<SceneLoadResult>
	setSceneMetaState: (sceneMeta: SceneMetaState) => void
	setLastSavedSceneMeta: (sceneMeta: SceneMetaState) => void
}

export const executePendingSceneDraftHydration = async ({
	draft,
	inferOptimizationPreset,
	setOptimizationState,
	setOptimizationRuntime,
	loadFromData,
	setSceneMetaState,
	setLastSavedSceneMeta
}: ExecutePendingSceneDraftHydrationParams): Promise<void> => {
	const draftOptimizationSettings = draft.optimizationSettings

	if (draftOptimizationSettings) {
		const inferredPreset = inferOptimizationPreset(draftOptimizationSettings)

		setOptimizationState((prev) => ({
			...prev,
			optimizationPreset: inferredPreset,
			optimizations: draftOptimizationSettings
		}))
	}

	// Restore byte-size snapshot so the save-availability check can determine
	// that optimization was already applied before the auth redirect.
	if (draft.optimizedSceneBytes != null || draft.clientSceneBytes != null) {
		setOptimizationRuntime((prev) => ({
			...prev,
			isSceneSizeLoading: false,
			...(draft.optimizedSceneBytes != null
				? { optimizedSceneBytes: draft.optimizedSceneBytes }
				: {}),
			...(draft.clientSceneBytes != null
				? { clientSceneBytes: draft.clientSceneBytes }
				: {})
		}))
	}

	await loadFromData({
		sceneData: draft.sceneData
	})

	setSceneMetaState(draft.sceneMeta)
	setLastSavedSceneMeta(draft.sceneMeta)
}
