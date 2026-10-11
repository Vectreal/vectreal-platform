import {
	getAssetSigningSecret,
	verifySignedAsset
} from './embed-asset-signature.server'
import { assetResponse } from '../../http/asset-response.server'
import { noStoreHeaders } from '../../http/response-headers.server'
import { reportServerError } from '../../observability/report-server-error.server'
import {
	AssetNotFoundError,
	downloadAsset,
	downloadAssetFromRow
} from '../asset/asset-storage.server'
import {
	isEmbedServableAssetId,
	selectEmbedServableAssets
} from '../scene/embed-asset-policy'
import { shouldShowLoadingThumbnail } from '../scene/scene-presentation'
import { type PublishedScenePreview } from '../scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../scene/server/scene-settings-service.server'

/*
  How the asset route answers an embed: a signed URL from a manifest, or an
  API key holder asking for an asset of a published scene. The route parses the
  request and authorizes the key; these decide which asset may be served and
  with what caching.
*/

type AssetIds = { sceneId: string; assetId: string }

async function serveEmbedAsset(
	request: Request,
	ids: AssetIds,
	download: () => Promise<{ data: Uint8Array; mimeType: string }>,
	extraHeaders?: HeadersInit
): Promise<Response> {
	try {
		const assetData = await download()
		return assetResponse(assetData.data, assetData.mimeType, extraHeaders)
	} catch (error) {
		reportServerError(error, { request, properties: ids })
		return new Response('Failed to load asset', {
			status: 500,
			headers: noStoreHeaders(extraHeaders)
		})
	}
}

/**
 * The published GLB, downloaded from the asset row the publication query
 * already joined. Null when `assetId` is not that GLB.
 *
 * It is the request every published load makes, so it skips the settings
 * transaction the rest of the published set needs. And it is the one asset no
 * `scene_assets` row names: `uploadPublishedGlb` never links it.
 */
export function serveFromPublishedRow(
	request: Request,
	ids: AssetIds,
	previewScene: PublishedScenePreview | null,
	extraHeaders?: HeadersInit
): Promise<Response> | null {
	if (!previewScene || ids.assetId !== previewScene.publishedAssetId) {
		return null
	}

	const {
		publishedAssetFilePath: filePath,
		publishedAssetName: name,
		publishedAssetMimeType: mimeType
	} = previewScene
	if (!filePath || !name) return null

	return serveEmbedAsset(
		request,
		ids,
		() => downloadAssetFromRow({ id: ids.assetId, filePath, mimeType, name }),
		extraHeaders
	)
}

/**
 * An asset of a published scene, for a caller whose API key the route has
 * already accepted: the published GLB, or one of the assets the embed manifest
 * references, and nothing else.
 */
export async function servePublishedEmbedAsset(
	request: Request,
	ids: AssetIds,
	previewScene: PublishedScenePreview
): Promise<Response> {
	const publishedModel = serveFromPublishedRow(request, ids, previewScene)
	if (publishedModel) return publishedModel

	/*
	  The servable set is computed by the same module the embed manifest
	  builds its refs from. This gate used to be an equality against
	  `publishedAssetId` alone - an id `uploadPublishedGlb` never links into
	  `scene_assets`, and therefore an id the manifest never referenced. The
	  two sets were disjoint, so every asset an embed asked for 404'd.
	*/
	const settingsData = await sceneSettingsService.getSceneSettingsWithAssetRefs(
		ids.sceneId,
		{
			includeGltfJson: false
		}
	)
	const servable = selectEmbedServableAssets({
		publishedAssetId: previewScene.publishedAssetId,
		sceneAssets: settingsData?.assets ?? [],
		bakedShadowAssetId: settingsData?.settings?.shadows?.baked?.assetId,
		showsLoadingThumbnail: shouldShowLoadingThumbnail(
			settingsData?.settings?.presentation
		)
	})

	if (!isEmbedServableAssetId(ids.assetId, servable)) {
		return new Response('Asset not found', {
			status: 404,
			headers: noStoreHeaders()
		})
	}

	return serveEmbedAsset(request, ids, () => downloadAsset(ids.assetId))
}

/**
 * An asset addressed by a signed URL from an embed manifest.
 *
 * The signature is the authorization: the manifest that handed it out already
 * checked the key, the domain and the publication. So this reads no key and no
 * scene, which is what lets the response be public and cached at the edge for
 * as long as the URL stays valid.
 *
 * GET only: the edge caches GETs, and any other method would download the
 * whole asset at the origin on every request.
 */
export async function serveSignedAsset(
	request: Request,
	target: AssetIds,
	url: URL
): Promise<Response> {
	if (request.method !== 'GET') {
		return new Response(null, {
			status: 405,
			headers: noStoreHeaders({ Allow: 'GET' })
		})
	}

	const secret = getAssetSigningSecret()
	const check = secret
		? verifySignedAsset(target, url, secret, Date.now())
		: null

	if (!check?.ok) {
		return new Response('Asset not found', {
			status: 404,
			headers: noStoreHeaders()
		})
	}

	try {
		const assetData = await downloadAsset(target.assetId)
		return assetResponse(
			assetData.data,
			assetData.mimeType,
			undefined,
			`public, max-age=${check.secondsLeft}, s-maxage=${check.secondsLeft}`
		)
	} catch (error) {
		// A republish deletes the previous GLB while URLs naming it are still
		// valid. That is expected, not a fault.
		if (error instanceof AssetNotFoundError) {
			return new Response('Asset not found', {
				status: 404,
				headers: noStoreHeaders()
			})
		}
		reportServerError(error, { request, properties: target })
		return new Response('Failed to load asset', {
			status: 500,
			headers: noStoreHeaders()
		})
	}
}
