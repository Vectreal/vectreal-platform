import type { KeptOriginalRef } from '../../lib/domain/scene/client/scene-save-orchestrator'
import type { SourceToSave } from '../../lib/domain/scene/client/scene-source-to-save'
import type { StudioFinishToSave } from '../../lib/domain/scene/studio-finish'
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
	/** Whether a model is on the stage; nothing can be saved before one is. */
	hasModel: boolean
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
	/**
	 * True while dirty detection has to stay suppressed: either the route's scene
	 * is still loading, or a route-opened scene's saved baseline has not hydrated
	 * yet.
	 */
	suppressDirtyDetection: boolean
	/** The author changed whether the scene keeps its original since the last save. */
	hasUnsavedOriginalChoice: boolean
}

export interface SceneOptimizationSaveState {
	optimizationSettings: Optimizations
	optimizationReport: OptimizationReport | null | undefined
	clientSceneBytes: null | number
	lastSavedReportSignature: null | string
	passRevision: number
	savedPassRevision: null | number
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
	captureSceneThumbnail: (targetCameraId?: string) => Promise<null | string>
	captureShadowBake: () => Promise<ShadowBakeResult | null>
	/**
	 * The studio finish this save keeps, read when it starts: null keeps none,
	 * undefined leaves the stored one as it is.
	 */
	captureStudioFinish: () => StudioFinishToSave | null | undefined
	/** What this save does with the scene's original, read when it starts. */
	resolveSource: () => SourceToSave
	/**
	 * Records what a save did with the original: the new baseline for the
	 * choice, and where the server now holds it. A save that kept none leaves
	 * nothing to re-link: the old one is unlinked and reclaimed.
	 */
	recordSavedSource: (kept: KeptOriginalRef | null) => void
}

export interface UseSceneSaveFlowArgs {
	scenePersistence: ScenePersistenceState
	optimizationState: SceneOptimizationSaveState
	actions: SceneSaveFlowActions
}

export type SceneSaveRequest = SaveLocationTarget | undefined
