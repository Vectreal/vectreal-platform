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
	/**
	 * The original the draft's document was derived from, as GLB bytes, so a
	 * restored draft can still be re-optimized from it rather than from its
	 * already-optimized self. Null for drafts written before it existed.
	 */
	sourceGlb: Uint8Array | null
	/**
	 * What `sourceGlb` already embodies: the original preset for an upload, the
	 * saved settings when the source was a saved, optimized scene. Absent on
	 * drafts written before it existed.
	 */
	sourceSettings?: Optimizations | null
	/**
	 * Whether the author chose to keep the original on save. Absent on drafts
	 * written before the choice existed, which read as the default, kept.
	 */
	keepOriginal?: boolean
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
	/**
	 * The original the draft's document was derived from, as GLB bytes, so a
	 * restored draft can still be re-optimized from it rather than from its
	 * already-optimized self. Null for drafts written before it existed.
	 */
	sourceGlb: Uint8Array | null
	/**
	 * What `sourceGlb` already embodies: the original preset for an upload, the
	 * saved settings when the source was a saved, optimized scene. Absent on
	 * drafts written before it existed.
	 */
	sourceSettings?: Optimizations | null
	/**
	 * Whether the author chose to keep the original on save. Absent on drafts
	 * written before the choice existed, which read as the default, kept.
	 */
	keepOriginal?: boolean
	/** Byte size of the optimized scene at the time of persisting. */
	optimizedSceneBytes?: number | null
	/** Byte size of the raw client scene at the time of persisting. */
	clientSceneBytes?: number | null
}
