import { SupersededError } from '@vctrl/core/model-optimizer'

import { serializeSceneAssetData } from './scene-draft-serialization'
import { originalPreset } from '../../../../constants/optimizations'
import { savePendingSceneDraft } from '../../../persistence/pending-scene-idb'

import type { SceneMetaState } from '../../../../types/publisher-config'
import type { Optimizations, SceneSettings, ServerSceneData } from '@vctrl/core'

interface PersistPendingSceneDraftParams {
	modelAvailable: boolean
	prepareGltfDocumentForUpload: () => Promise<unknown>
	sceneMetaState: SceneMetaState
	currentSettings: SceneSettings
	optimizationSettings: Optimizations | null
	/** The original the document was derived from, so a restore keeps it. */
	sourceGlb: Uint8Array | null
	/** What `sourceGlb` already embodies, so a restore does not mislabel it. */
	sourceSettings?: Optimizations | null
	/** Whether the author chose to keep the original on save; kept when unsaid. */
	keepOriginal?: boolean
	/** Byte size of the optimized scene, used to restore save-availability on hydration. */
	optimizedSceneBytes?: number | null
	/** Byte size of the raw client scene, used to restore save-availability on hydration. */
	clientSceneBytes?: number | null
}

export const persistPendingSceneDraftOrchestrator = async ({
	modelAvailable,
	prepareGltfDocumentForUpload,
	sceneMetaState,
	currentSettings,
	optimizationSettings,
	sourceGlb,
	sourceSettings,
	keepOriginal,
	optimizedSceneBytes,
	clientSceneBytes
}: PersistPendingSceneDraftParams): Promise<string | false> => {
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

	// Spread the settings rather than listing their fields. `ServerSceneData`
	// extends `SceneSettings`, so enumerating them here made "dropped" the
	// default for anything added later: `hotspots`, `interactions` and
	// `normalization` were all passed by the caller and silently discarded, and
	// an author who signed in mid-compose got the draft back without them.
	const sceneData: ServerSceneData = {
		...currentSettings,
		meta: {
			name: sceneMetaState.name,
			description: sceneMetaState.description,
			thumbnailUrl: sceneMetaState.thumbnailUrl
		},
		gltfJson: gltfData as ServerSceneData['gltfJson'],
		assetData
	}

	return savePendingSceneDraft({
		sceneMeta: sceneMetaState,
		sceneData,
		optimizationSettings,
		sourceGlb,
		sourceSettings,
		keepOriginal,
		optimizedSceneBytes,
		clientSceneBytes
	})
}

/**
 * What a restored draft's document was derived from, and what its source
 * already embodies.
 *
 * A draft states both. Older drafts do not: one carrying an original was
 * written from an upload, one without settings (the converter's) is its own
 * original, and one with settings but no original has only its own document as
 * a source, which already embodies those settings.
 */
export const resolveRestoredDraftOptimization = ({
	optimizationSettings,
	sourceGlb,
	sourceSettings
}: {
	optimizationSettings: Optimizations | null
	sourceGlb: Uint8Array | null | undefined
	sourceSettings?: Optimizations | null
}): { sourceSettings: Optimizations; derivedFrom: Optimizations } => {
	const derivedFrom = optimizationSettings ?? originalPreset
	return {
		sourceSettings:
			sourceSettings ?? (sourceGlb ? originalPreset : derivedFrom),
		derivedFrom
	}
}

/**
 * States a restored draft's original on the optimizer, so later passes start
 * from it rather than from the optimized version the draft loaded as.
 *
 * Only while the draft's load is the newest: otherwise the original would
 * become the source of whatever model replaced it. Best effort, because the
 * draft is on screen either way and the rest of its restore must still run;
 * without its original, later passes start from the restored version.
 *
 * Resolves `true` when the draft's original could not be stated for a load
 * that is still current, so the caller describes the source as the restored
 * version instead (`resolveRestoredDraftOptimization` with no original).
 */
export const restoreDraftSource = async ({
	sourceGlb,
	isCurrent,
	setSource
}: {
	sourceGlb: Uint8Array | null
	isCurrent: () => boolean
	setSource: (bytes: Uint8Array) => Promise<void>
}): Promise<boolean> => {
	if (!sourceGlb || !isCurrent()) return false
	try {
		await setSource(sourceGlb)
		return false
	} catch (error) {
		// A newer model owns the optimizer; it has nothing to report.
		if (error instanceof SupersededError) return false
		console.warn('Could not restore the draft original:', error)
		// Asked again: the failure took an await, and the draft may have been
		// replaced on screen meanwhile.
		return isCurrent()
	}
}
