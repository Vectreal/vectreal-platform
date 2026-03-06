import type { SceneMetaState } from './publisher-config'
import type { Optimizations, ServerSceneData } from '@vctrl/core'

/**
 * Persisted publisher draft payload stored in IndexedDB.
 *
 * The `id` is tab-scoped so multiple publisher tabs don't overwrite each other.
 */
export interface PendingSceneDraft {
	id: string
	createdAt: number
	expiresAt: number
	sceneMeta: SceneMetaState
	sceneData: ServerSceneData
	optimizationSettings: Optimizations | null
}

/**
 * Input used when writing a pending scene draft before auth redirects.
 */
export interface SavePendingSceneDraftInput {
	sceneMeta: SceneMetaState
	sceneData: ServerSceneData
	optimizationSettings: Optimizations | null
}
