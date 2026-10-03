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
import {
	getAssetSigningSecret,
	verifySignedAsset
} from '../../lib/domain/embed/embed-asset-signature.server'
import {
	isEmbedServableAssetId,
	selectEmbedServableAssets
} from '../../lib/domain/scene/embed-asset-policy'
import { shouldShowLoadingThumbnail } from '../../lib/domain/scene/scene-presentation'
import { getScene } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../../lib/domain/scene/server/scene-settings-service.server'
import { getAuthUser } from '../../lib/http/auth.server'
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

// Asset rows are content-addressed per save: new bytes always get a new UUID
// (upsert: false, path embeds assetId), so immutable caching is safe here.
const ASSET_CACHE_CONTROL = 'private, max-age=31536000, immutable'

// Only these MIME types are served verbatim. Anything else (including
// text/html, image/svg+xml, application/xml, and unknown types) is downgraded
// to application/octet-stream to prevent stored-XSS via client-supplied types.
const PASSIVE_MIME_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/ktx2',
	'image/avif',
	'model/gltf-binary',
	'model/gltf+json',
	'application/octet-stream'
])

function sanitizeMimeType(mimeType: string | undefined | null): string {
	if (!mimeType || !PASSIVE_MIME_TYPES.has(mimeType)) {
		return 'application/octet-stream'
	}
	return mimeType
}

function withNoStoreHeaders(init?: HeadersInit): Headers {
	const headers = new Headers(init)
	headers.set('Cache-Control', 'no-store')
	return headers
}

function assetResponse(
	data: Uint8Array,
	mimeType: string,
	extraHeaders?: HeadersInit,
	cacheControl = ASSET_CACHE_CONTROL
): Response {
	const headers = new Headers(extraHeaders)
	headers.set('Content-Type', sanitizeMimeType(mimeType))
	headers.set('Cache-Control', cacheControl)
	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('Content-Security-Policy', 'sandbox')
	return new Response(new Blob([Buffer.from(data)]), { status: 200, headers })
}

async function serveEmbedAsset(
	request: Request,
	ids: { sceneId: string; assetId: string },
	download: () => Promise<{ data: Uint8Array; mimeType: string }>
): Promise<Response> {
	try {
		const assetData = await download()
		return assetResponse(assetData.data, assetData.mimeType)
	} catch (error) {
		reportServerError(error, { request, properties: ids })
		return new Response('Failed to load asset', {
			status: 500,
			headers: withNoStoreHeaders()
		})
	}
}

/**
 * An asset addressed by a signed URL from an embed manifest.
 *
 * The signature is the authorization: the manifest that handed it out already
 * checked the key, the domain and the publication. So this reads no key and no
 * scene, which is what lets the response be public and cached at the edge for
 * as long as the URL stays valid.
 */
async function serveSignedAsset(
	request: Request,
	target: { sceneId: string; assetId: string },
	search: string
): Promise<Response> {
	const secret = getAssetSigningSecret()
	const check = secret
		? verifySignedAsset(target, search, secret, Date.now())
		: null

	if (!check?.ok) {
		return new Response('Asset not found', {
			status: 404,
			headers: withNoStoreHeaders()
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
				headers: withNoStoreHeaders()
			})
		}
		reportServerError(error, { request, properties: target })
		return new Response('Failed to load asset', {
			status: 500,
			headers: withNoStoreHeaders()
		})
	}
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const sceneId = params.sceneId?.trim()
	const assetId = params.assetId?.trim()

	if (!sceneId || !assetId) {
		return new Response('Missing scene or asset ID', {
			status: 400,
			headers: withNoStoreHeaders()
		})
	}

	const url = new URL(request.url)

	if (url.searchParams.has('sig')) {
		return serveSignedAsset(request, { sceneId, assetId }, url.search)
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
				headers: withNoStoreHeaders()
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
				headers: withNoStoreHeaders()
			})
		}

		const previewScene = await getPublishedScenePreview(projectId, sceneId)
		if (!previewScene) {
			return new Response('Asset not found', {
				status: 404,
				headers: withNoStoreHeaders()
			})
		}

		/*
		  The published GLB is servable by definition, and it is the request
		  every embed makes, so it skips the settings transaction below - which
		  exists only to learn the bake's id - and is downloaded from the asset
		  row the preview query already joined.
		*/
		const { publishedAssetFilePath: filePath, publishedAssetName: name } =
			previewScene
		if (assetId === previewScene.publishedAssetId && filePath && name) {
			const mimeType = previewScene.publishedAssetMimeType
			return serveEmbedAsset(request, { sceneId, assetId }, () =>
				downloadAssetFromRow({ id: assetId, filePath, mimeType, name })
			)
		}

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
				headers: withNoStoreHeaders()
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

	// Authorization gate first: ensures unauthorized users get the same 404
	// regardless of whether the asset exists, preventing existence oracle leaks.
	const scene = await getScene(sceneId, auth.user.id)
	if (!scene) {
		return new Response('Asset not found', {
			status: 404,
			headers: withNoStoreHeaders(authHeaders)
		})
	}

	// Asset-to-scene link check: assets are de-duplicated per project by content
	// hash, so the same asset row can be shared by multiple scenes — this must
	// check the scene_assets join table, not a single-owner field on the asset.
	if (!(await assetBelongsToScene(assetId, sceneId))) {
		return new Response('Asset not found', {
			status: 404,
			headers: withNoStoreHeaders(authHeaders)
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
			headers: withNoStoreHeaders(authHeaders)
		})
	}
}
