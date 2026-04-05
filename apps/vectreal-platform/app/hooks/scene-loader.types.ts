import type { SceneAggregateResponse, SceneStatsData } from '../types/api'
import type { SceneMetaState } from '../types/publisher-config'
import type {
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../types/scene-optimization'
import type { SceneSettings } from '@vctrl/core'
import type { OptimizationReport, Optimizations } from '@vctrl/core'
import type {
	SceneDataLoadOptions,
	SceneLoadResult,
	ServerSceneData
} from '@vctrl/hooks/use-load-model'

export interface UseSceneLoaderParams {
	sceneId: null | string
	userId?: string
	initialSceneAggregate?: SceneAggregateResponse | null
	sceneMeta?: SceneMetaState | null
}

export interface SaveSceneResult {
	sceneId?: string
	stats?: SceneStatsData | null
	sceneMeta?: SceneMetaState
	unchanged?: boolean
	[key: string]: unknown
}

export interface SaveLocationTarget {
	targetProjectId?: string
	targetFolderId?: string | null
}

export type SaveAvailabilityReason =
	| 'ready'
	| 'no-user'
	| 'no-unsaved-changes'
	| 'requires-first-optimization'

export interface SaveAvailabilityState {
	canSave: boolean
	reason: SaveAvailabilityReason
	isFirstSavePendingOptimization: boolean
}

/** Canonical type for the scene-settings save function passed throughout the publisher. */
export type SaveSceneFn = () => Promise<
	SaveSceneResult | { unchanged: true } | undefined
>

export interface SceneSaveFlowArgs {
	userId?: string
	currentSceneId: null | string
	setCurrentSceneId: (sceneId: null | string) => void
	currentSettings: SceneSettings
	sceneMetaState: SceneMetaState
	setSceneMetaState: (sceneMetaState: SceneMetaState) => void
	lastSavedSettings: SceneSettings | null
	setLastSavedSettings: (settings: SceneSettings) => void
	lastSavedSceneMeta: SceneMetaState | null
	setLastSavedSceneMeta: (sceneMetaState: SceneMetaState | null) => void
	isInitializing: boolean
	processHasUnsavedChanges: boolean
	setHasUnsavedChanges: (hasChanges: boolean) => void
	latestSceneStats: SceneStatsData | null
	optimizedSceneBytes: null | number
	clientSceneBytes: null | number
	lastSavedReportSignature: null | string
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
	revalidate: () => void
	clearPendingDraft: () => Promise<void>
	optimizationSettings: Optimizations
	optimizationReport: OptimizationReport | null | undefined
	createRequestId: () => string
	prepareGltfDocumentForUpload: () => Promise<unknown>
	captureSceneThumbnail: () => Promise<null | string>
	maxConcurrentAssetUploadsDefault: number
}

export interface SceneDraftRehydrationParams {
	inferOptimizationPreset: (optimizations: Optimizations) => string
	setOptimizationState: (
		updater: (prev: OptimizationState) => OptimizationState
	) => void
	loadFromData: (params: SceneDataLoadOptions) => Promise<SceneLoadResult>
	setSceneMetaState: (sceneMeta: SceneMetaState) => void
	setLastSavedSceneMeta: (sceneMeta: SceneMetaState) => void
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
	setCurrentSceneId: (sceneId: string | null) => void
	setLastSavedSettings: (settings: SceneSettings) => void
	serverSceneData?: ServerSceneData
}
