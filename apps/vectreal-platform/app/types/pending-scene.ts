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
	/** Byte size of the optimized scene at the time of persisting. Restored on draft hydration to re-enable saving without re-optimizing. */
	optimizedSceneBytes?: number | null
	/** Byte size of the raw client scene at the time of persisting. */
	clientSceneBytes?: number | null
}

/**
 * Input used when writing a pending scene draft before auth redirects.
 */
export interface SavePendingSceneDraftInput {
	sceneMeta: SceneMetaState
	sceneData: ServerSceneData
	optimizationSettings: Optimizations | null
	/** Byte size of the optimized scene at the time of persisting. */
	optimizedSceneBytes?: number | null
	/** Byte size of the raw client scene at the time of persisting. */
	clientSceneBytes?: number | null
}
