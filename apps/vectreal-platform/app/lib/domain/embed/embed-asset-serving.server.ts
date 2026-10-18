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
import {
	getPublishedSceneById,
	type PublishedScenePreview
} from '../scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../scene/server/scene-settings-service.server'

/*
  How the asset route answers an embed: a signed URL from a manifest, or an
  API key holder asking for an asset of a published scene. The route parses the
  request and authorizes the key; these decide which asset may be served and
  with what caching.
*/

type AssetIds = { sceneId: string; assetId: string }

/**
 * How long the edge may hold a side asset (the loading thumbnail, the shadow
 * bake) fetched through a signed URL.
 *
 * Side assets are servable only while the scene's live settings say so, and an
 * author can withdraw one without republishing: switching the loading
 * thumbnail off is one click on the dashboard. Every edge miss re-checks that
 * at the origin, so this is how long a withdrawn asset can still be served.
 *
 * The published GLB keeps the URL's full lifetime. A republish gives it a new
 * id, so the old URL simply stops being asked for; an unpublish is refused at
 * the origin, but an edge that already holds the GLB keeps serving it until the
 * URL expires. Shortening that is the open question of how long signed URLs
 * should live, not this constant.
 */
export const SIDE_ASSET_MAX_AGE_SECONDS = 300

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
 * Whether an asset other than the published GLB may go to an embed now.
 *
 * Computed by the same module the embed manifest builds its refs from, and
 * read from the scene's live settings, so it answers for the manifest a
 * visitor would get at this moment. Both embed branches ask it, which is what
 * keeps a key holder and a signed URL from disagreeing.
 *
 * The key branch's gate used to be an equality against `publishedAssetId`
 * alone - an id `uploadPublishedGlb` never links into `scene_assets`, and
 * therefore an id the manifest never referenced. The two sets were disjoint,
 * so every asset an embed asked for 404'd.
 */
async function isServableSideAsset(
	ids: AssetIds,
	previewScene: PublishedScenePreview
): Promise<boolean> {
	const settingsData = await sceneSettingsService.getSceneSettingsWithAssetRefs(
		ids.sceneId,
		{
			includeGltfJson: false
		}
	)
	const servable = selectEmbedServableAssets({
		sceneId: ids.sceneId,
		publishedAssetId: previewScene.publishedAssetId,
		sceneAssets: settingsData?.assets ?? [],
		bakedShadowAssetId: settingsData?.settings?.shadows?.baked?.assetId,
		showsLoadingThumbnail: shouldShowLoadingThumbnail(
			settingsData?.settings?.presentation
		),
		hotspots: settingsData?.settings?.hotspots
	})

	return isEmbedServableAssetId(ids.assetId, servable)
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

	if (!(await isServableSideAsset(ids, previewScene))) {
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
 * The signature proves the URL came from a manifest, which checked the key,
 * the domain and the publication when it was built. It does not prove the
 * asset is still part of what an embed gets: a side asset leaves that set the
 * moment the author's settings say so, without a publish. So the publication
 * and the servable set are read here as well, on every request that reaches
 * the origin, and a side asset is cached at the edge for
 * {@link SIDE_ASSET_MAX_AGE_SECONDS} at most, while the published GLB keeps
 * the URL's whole remaining life.
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

	const notFound = () =>
		new Response('Asset not found', {
			status: 404,
			headers: noStoreHeaders()
		})

	const secret = getAssetSigningSecret()
	const check = secret
		? verifySignedAsset(target, url, secret, Date.now())
		: null

	if (!check?.ok) return notFound()

	const previewScene = await getPublishedSceneById(target.sceneId)
	if (!previewScene) return notFound()

	const isPublishedModel = target.assetId === previewScene.publishedAssetId
	if (!isPublishedModel && !(await isServableSideAsset(target, previewScene))) {
		return notFound()
	}

	const maxAge = isPublishedModel
		? check.secondsLeft
		: Math.min(check.secondsLeft, SIDE_ASSET_MAX_AGE_SECONDS)

	try {
		// By id rather than from the joined row: a row deleted since the lookup
		// then throws `AssetNotFoundError`, which is answered quietly below.
		const assetData = await downloadAsset(target.assetId)
		return assetResponse(
			assetData.data,
			assetData.mimeType,
			undefined,
			`public, max-age=${maxAge}, s-maxage=${maxAge}`
		)
	} catch (error) {
		// A republish between the lookup above and this download deletes the
		// row it named. That is expected, not a fault.
		if (error instanceof AssetNotFoundError) return notFound()
		reportServerError(error, { request, properties: target })
		return new Response('Failed to load asset', {
			status: 500,
			headers: noStoreHeaders()
		})
	}
}
