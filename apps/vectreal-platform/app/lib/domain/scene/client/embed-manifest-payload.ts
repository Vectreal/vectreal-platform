import type { SceneEmbedManifestResponse } from '../../../../types/api'
import type { ServerScenePayload } from '@vctrl/core'
import type { ModelSource } from '@vctrl/hooks/use-load-model'

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

/**
 * Where a viewer loads its scene from: the manifest the document carried when
 * it carried one, and the server otherwise.
 *
 * The inline manifest is a published scene's, so no manifest request is made
 * and no key is sent as a header with its asset requests, which is what lets
 * them reuse the document's preloads.
 */
export function sceneSourceFromManifest<TServer extends ModelSource | null>(
	sceneId: string,
	manifest: SceneEmbedManifestResponse | null | undefined,
	serverSource: TServer
): ModelSource | TServer {
	if (!manifest) return serverSource

	return {
		kind: 'scene-data',
		sceneId,
		sceneData: embedManifestToScenePayload(manifest),
		parseMode: 'direct'
	}
}
