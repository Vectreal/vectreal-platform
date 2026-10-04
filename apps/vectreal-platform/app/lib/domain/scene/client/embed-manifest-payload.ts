import type { SceneEmbedManifestResponse } from '../../../../types/api'
import type { ServerScenePayload } from '@vctrl/core'

/**
 * An embed manifest as the scene loader reads one.
 *
 * The same object the manifest endpoint returns, which the loader already
 * accepts as a payload; an embed carries no editor document and no inline
 * bytes, and says so.
 */
export function embedManifestToScenePayload(
	manifest: SceneEmbedManifestResponse
): ServerScenePayload {
	return {
		meta: manifest.meta ?? undefined,
		settings: manifest.settings,
		publishedModel: manifest.publishedModel,
		assetRefs: manifest.assetRefs,
		gltfJson: null,
		assetData: null
	}
}
