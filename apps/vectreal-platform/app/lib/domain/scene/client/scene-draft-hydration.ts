import type { PendingSceneDraft } from '../../../../types/pending-scene'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type {
	OptimizationPreset,
	OptimizationState
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
	loadFromData: (params: SceneDataLoadOptions) => Promise<SceneLoadResult>
	setSceneMetaState: (sceneMeta: SceneMetaState) => void
	setLastSavedSceneMeta: (sceneMeta: SceneMetaState) => void
}

export const executePendingSceneDraftHydration = async ({
	draft,
	inferOptimizationPreset,
	setOptimizationState,
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

	await loadFromData({
		sceneData: draft.sceneData
	})

	setSceneMetaState(draft.sceneMeta)
	setLastSavedSceneMeta(draft.sceneMeta)
}
