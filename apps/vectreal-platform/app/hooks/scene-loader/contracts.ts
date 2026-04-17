import type { SceneAggregateResponse, SceneStatsData } from '../../types/api'
import type { SceneMetaState } from '../../types/publisher-config'
import type { SaveLocationTarget } from '../../types/publisher-scene'
import type {
	OptimizationPreset,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../types/scene-optimization'
import type {
	OptimizationReport,
	Optimizations,
	SceneSettings
} from '@vctrl/core'
import type { EventHandler, EventTypes } from '@vctrl/hooks/use-load-model'
import type {
	SceneDataLoadOptions,
	SceneLoadResult
} from '@vctrl/hooks/use-load-model'
import type { MutableRefObject } from 'react'

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
	isInitializing: boolean
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
	maxConcurrentAssetUploadsDefault: number
}

export interface UseSceneSaveFlowArgs {
	scenePersistence: ScenePersistenceState
	optimizationState: SceneOptimizationSaveState
	actions: SceneSaveFlowActions
}

export interface DraftRestoreRequest {
	pendingSceneHydratedRef: MutableRefObject<boolean>
	shouldRestorePendingDraft: boolean
	/** Optional draft ID embedded in the URL, enables cross-tab restoration after OAuth. */
	draftId?: string | null
	paramSceneId: null | string
	initialSceneAggregate: null | SceneAggregateResponse
	fileModel: unknown
	isFileLoading: boolean
	locationPathname: string
	onRestoreHandled?: () => void
}

export interface DraftHydrationActions {
	setIsDownloading: (loading: boolean) => void
	loadFromData: (params: SceneDataLoadOptions) => Promise<SceneLoadResult>
	setSceneMetaState: (sceneMeta: SceneMetaState) => void
	setLastSavedSceneMeta: (sceneMeta: SceneMetaState) => void
}

export interface DraftOptimizationActions {
	inferOptimizationPreset: (optimizations: Optimizations) => OptimizationPreset
	setOptimizationState: (
		updater: (prev: OptimizationState) => OptimizationState
	) => void
	setOptimizationRuntime: (
		updater: (
			prev: SceneOptimizationRuntimeState
		) => SceneOptimizationRuntimeState
	) => void
}

export interface UseSceneDraftRehydrationArgs {
	restoreRequest: DraftRestoreRequest
	hydrationActions: DraftHydrationActions
	optimizationActions: DraftOptimizationActions
}

export interface SceneRouteSyncState {
	paramSceneId: null | string
	sceneMeta: null | SceneMetaState
	initialSceneAggregate: null | SceneAggregateResponse
	lastSavedSceneId: string | null
}

export interface SceneRouteSyncActions {
	resetSceneState: () => void
	setCurrentSceneId: (sceneId: null | string) => void
	setSceneMetaState: (
		next: SceneMetaState | ((prev: SceneMetaState) => SceneMetaState)
	) => void
	setLastSavedSettings: (settings: SceneSettings | null) => void
	setLastSavedSceneMeta: (sceneMetaState: null | SceneMetaState) => void
	setIsInitializing: (initializing: boolean) => void
	setHasUnsavedChanges: (hasChanges: boolean) => void
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
	setLastSavedSceneId: (sceneId: string | null) => void
}

export interface UseSceneParamsSyncArgs {
	routeState: SceneRouteSyncState
	actions: SceneRouteSyncActions
}

export interface SceneAggregateBootstrapState {
	sceneLoadAttemptedRef: MutableRefObject<boolean>
	paramSceneId: null | string
	initialSceneAggregate: null | SceneAggregateResponse
	fileModel: unknown
	isFileLoading: boolean
}

export interface SceneAggregateBootstrapActions {
	setIsInitializing: (initializing: boolean) => void
	loadSceneFromAggregate: (
		sceneId: string,
		aggregate: SceneAggregateResponse
	) => Promise<void>
}

export interface UseSceneAggregateBootstrapArgs {
	bootstrapState: SceneAggregateBootstrapState
	actions: SceneAggregateBootstrapActions
}

export interface SceneModelEventBindings {
	on: <TEventName extends EventTypes>(
		eventName: TEventName,
		handler: EventHandler<TEventName>
	) => void
	off: <TEventName extends EventTypes>(
		eventName: TEventName,
		handler: EventHandler<TEventName>
	) => void
	handleNotLoadedFiles: EventHandler<'not-loaded-files'>
	handleLoadComplete: EventHandler<'load-complete'>
	handleLoadError: EventHandler<'load-error'>
}

export type SceneSaveRequest = SaveLocationTarget | undefined
