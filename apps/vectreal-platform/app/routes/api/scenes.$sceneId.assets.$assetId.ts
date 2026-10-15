import { LoaderFunctionArgs } from 'react-router'

import { downloadAsset } from '../../lib/domain/asset/asset-storage.server'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { hasPreviewTokenCredential } from '../../lib/domain/embed/embed-access-policy'
import {
	serveFromPublishedRow,
	servePublishedEmbedAsset,
	serveSignedAsset
} from '../../lib/domain/embed/embed-asset-serving.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { isAssetLinkedToScene } from '../../lib/domain/scene/server/scene-settings-repository.server'
import { assetResponse } from '../../lib/http/asset-response.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { noStoreHeaders } from '../../lib/http/response-headers.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

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
	const hasTokenCredential = hasPreviewTokenCredential(request)

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

		return servePublishedEmbedAsset(request, { sceneId, assetId }, previewScene)
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
		isAssetLinkedToScene(assetId, sceneId)
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
