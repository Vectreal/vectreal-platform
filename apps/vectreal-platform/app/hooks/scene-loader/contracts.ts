import type { SceneStatsData } from '../../types/api'
import type { SceneMetaState } from '../../types/publisher-config'
import type { SaveLocationTarget } from '../../types/publisher-scene'
import type { SceneOptimizationRuntimeState } from '../../types/scene-optimization'
import type {
	OptimizationReport,
	Optimizations,
	SceneSettings
} from '@vctrl/core'
import type { ShadowBakeResult } from '@vctrl/viewer'

export interface ScenePersistenceState {
	userId?: string
	currentSceneId: null | string
	setCurrentSceneId: (sceneId: null | string) => void
	currentSettings: SceneSettings
	sceneMetaState: SceneMetaState
	setSceneMetaState: (
		next: SceneMetaState | ((prev: SceneMetaState) => SceneMetaState)
	) => void
	lastSavedSettings: SceneSettings | null
	setLastSavedSettings: (settings: SceneSettings) => void
	lastSavedSceneMeta: SceneMetaState | null
	setLastSavedSceneMeta: (sceneMetaState: SceneMetaState | null) => void
	lastSavedSceneId: string | null
	setLastSavedSceneId: (sceneId: string | null) => void
	/** True while the route's scene is still loading. */
	isLoading: boolean
}

export interface SceneOptimizationSaveState {
	optimizationSettings: Optimizations
	optimizationReport: OptimizationReport | null | undefined
	latestSceneStats: SceneStatsData | null
	optimizedSceneBytes: null | number
	clientSceneBytes: null | number
	lastSavedReportSignature: null | string
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
}

export interface SceneSaveFlowActions {
	setHasUnsavedChanges: (hasChanges: boolean) => void
	revalidate: () => void
	clearPendingDraft: () => Promise<void>
	createRequestId: () => string
	prepareGltfDocumentForUpload: () => Promise<unknown>
	captureSceneThumbnail: () => Promise<null | string>
	captureShadowBake: () => Promise<ShadowBakeResult | null>
}

export interface UseSceneSaveFlowArgs {
	scenePersistence: ScenePersistenceState
	optimizationState: SceneOptimizationSaveState
	actions: SceneSaveFlowActions
}

export type SceneSaveRequest = SaveLocationTarget | undefined
