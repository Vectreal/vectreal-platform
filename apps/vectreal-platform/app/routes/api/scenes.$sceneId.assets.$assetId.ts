import { and, eq } from 'drizzle-orm'
import { LoaderFunctionArgs } from 'react-router'

import { getDbClient } from '../../db/client'
import { sceneAssets, sceneSettings } from '../../db/schema'
import {
	AssetNotFoundError,
	downloadAsset,
	downloadAssetFromRow
} from '../../lib/domain/asset/asset-storage.server'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import {
	getAssetSigningSecret,
	verifySignedAsset
} from '../../lib/domain/embed/embed-asset-signature.server'
import {
	isEmbedServableAssetId,
	selectEmbedServableAssets
} from '../../lib/domain/scene/embed-asset-policy'
import { shouldShowLoadingThumbnail } from '../../lib/domain/scene/scene-presentation'
import {
	getPublishedScenePreview,
	type PublishedScenePreview
} from '../../lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../../lib/domain/scene/server/scene-settings-service.server'
import { assetResponse } from '../../lib/http/asset-response.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { noStoreHeaders } from '../../lib/http/response-headers.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

const db = getDbClient()

/**
 * Whether `assetId` is linked to `sceneId` via the `scene_assets` join table.
 *
 * Assets are de-duplicated per project by content hash (see
 * `uploadSceneAssets`), so the same asset row can legitimately be shared by
 * multiple scenes — the asset's `metadata.sceneId` only records the scene
 * that happened to create the row first and must not be used for
 * authorization.
 */
async function assetBelongsToScene(
	assetId: string,
	sceneId: string
): Promise<boolean> {
	const [row] = await db
		.select({ assetId: sceneAssets.assetId })
		.from(sceneAssets)
		.innerJoin(sceneSettings, eq(sceneAssets.sceneSettingsId, sceneSettings.id))
		.where(
			and(eq(sceneAssets.assetId, assetId), eq(sceneSettings.sceneId, sceneId))
		)
		.limit(1)

	return Boolean(row)
}

async function serveEmbedAsset(
	request: Request,
	ids: { sceneId: string; assetId: string },
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
function serveFromPublishedRow(
	request: Request,
	ids: { sceneId: string; assetId: string },
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
async function serveSignedAsset(
	request: Request,
	target: { sceneId: string; assetId: string },
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

export async function loader({ request, params }: LoaderFunctionArgs) {
	const sceneId = params.sceneId?.trim()
	const assetId = params.assetId?.trim()

	if (!sceneId || !assetId) {
		return new Response('Missing scene or asset ID', {
			status: 400,
			headers: noStoreHeaders()
		})
	}

	const url = new URL(request.url)

	if (url.searchParams.has('sig')) {
		return serveSignedAsset(request, { sceneId, assetId }, url)
	}

	const isPreviewRequest = url.searchParams.get('preview') === '1'

	// Token credential present means the caller is using an API key (embedded
	// player, public preview). No token means the caller is a cookie-authenticated
	// session - fall through to the session branch in both preview and non-preview.
	const hasTokenCredential =
		Boolean(url.searchParams.get('token')?.trim()) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (isPreviewRequest && hasTokenCredential) {
		const projectId = url.searchParams.get('projectId')?.trim()
		if (!projectId) {
			return new Response('Project ID is required', {
				status: 400,
				headers: noStoreHeaders()
			})
		}

		const validation = await validatePreviewApiKeyForProject({
			request,
			projectId
		})

		if (!validation.ok) {
			const status =
				validation.error === 'rate_limited'
					? 429
					: validation.error === 'domain_not_allowed'
						? 403
						: 404
			return new Response('Asset not found', {
				status,
				headers: noStoreHeaders()
			})
		}

		const previewScene = await getPublishedScenePreview(projectId, sceneId)
		if (!previewScene) {
			return new Response('Asset not found', {
				status: 404,
				headers: noStoreHeaders()
			})
		}

		const publishedModel = serveFromPublishedRow(
			request,
			{ sceneId, assetId },
			previewScene
		)
		if (publishedModel) return publishedModel

		/*
		  The servable set is computed by the same module the embed manifest
		  builds its refs from. This gate used to be an equality against
		  `publishedAssetId` alone - an id `uploadPublishedGlb` never links into
		  `scene_assets`, and therefore an id the manifest never referenced. The
		  two sets were disjoint, so every asset an embed asked for 404'd.
		*/
		const settingsData =
			await sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId, {
				includeGltfJson: false
			})
		const servable = selectEmbedServableAssets({
			publishedAssetId: previewScene.publishedAssetId,
			sceneAssets: settingsData?.assets ?? [],
			bakedShadowAssetId: settingsData?.settings?.shadows?.baked?.assetId,
			showsLoadingThumbnail: shouldShowLoadingThumbnail(
				settingsData?.settings?.presentation
			)
		})

		if (!isEmbedServableAssetId(assetId, servable)) {
			return new Response('Asset not found', {
				status: 404,
				headers: noStoreHeaders()
			})
		}

		return serveEmbedAsset(request, { sceneId, assetId }, () =>
			downloadAsset(assetId)
		)
	}

	// Session branch: handles both plain authenticated requests and cookie-
	// authenticated preview requests (preview=1 without a token credential).
	const auth = await getAuthUser(request)
	if (auth instanceof Response) {
		return auth
	}

	const authHeaders = auth.headers ?? {}

	/*
	  Authorization gate first: a non-member gets the same 404 whether or not
	  the asset exists, so the route is no existence oracle. A membership
	  lookup rather than `getScene`, which throws for a non-member and turned
	  that 404 into a 500.
	*/
	const membership = await resolveSceneMembership(sceneId, auth.user.id)
	if (!membership) {
		return new Response('Asset not found', {
			status: 404,
			headers: noStoreHeaders(authHeaders)
		})
	}

	/*
	  A member may fetch every asset the scene links, plus the published GLB:
	  `/preview` and the dashboard load a published scene from the same
	  manifest an embed gets. Never narrowed to the embed's servable set, which
	  would refuse the draft's buffers to the editor.

	  Linked is checked through `scene_assets`, not a single-owner field on the
	  asset: assets are de-duplicated per project by content hash, so one row
	  can belong to several scenes.
	*/
	const [previewScene, isLinked] = await Promise.all([
		getPublishedScenePreview(membership.projectId, sceneId),
		assetBelongsToScene(assetId, sceneId)
	])

	const publishedModel = serveFromPublishedRow(
		request,
		{ sceneId, assetId },
		previewScene,
		authHeaders
	)
	if (publishedModel) return publishedModel

	if (!isLinked) {
		return new Response('Asset not found', {
			status: 404,
			headers: noStoreHeaders(authHeaders)
		})
	}

	try {
		const assetData = await downloadAsset(assetId)
		return assetResponse(assetData.data, assetData.mimeType, authHeaders)
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { sceneId, assetId, userId: auth.user.id }
		})
		return new Response('Failed to load asset', {
			status: 500,
			headers: noStoreHeaders(authHeaders)
		})
	}
}
