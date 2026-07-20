import { and, eq } from 'drizzle-orm'
import { LoaderFunctionArgs } from 'react-router'

import { getDbClient } from '../../db/client'
import { sceneAssets, sceneSettings } from '../../db/schema'
import { downloadAsset } from '../../lib/domain/asset/asset-storage.server'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { getScene } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'

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
	'application/octet-stream',
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
	extraHeaders?: HeadersInit
): Response {
	const headers = new Headers(extraHeaders)
	headers.set('Content-Type', sanitizeMimeType(mimeType))
	headers.set('Cache-Control', ASSET_CACHE_CONTROL)
	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('Content-Security-Policy', 'sandbox')
	return new Response(new Blob([Buffer.from(data)]), { status: 200, headers })
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
		if (!previewScene || previewScene.publishedAssetId !== assetId) {
			return new Response('Asset not found', {
				status: 404,
				headers: withNoStoreHeaders()
			})
		}

		try {
			const assetData = await downloadAsset(assetId)
			return assetResponse(assetData.data, assetData.mimeType)
		} catch (error) {
			console.error('Failed to stream preview scene asset', {
				sceneId,
				assetId,
				error
			})
			return new Response('Failed to load asset', {
				status: 500,
				headers: withNoStoreHeaders()
			})
		}
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
		console.error('Failed to stream scene asset', {
			sceneId,
			assetId,
			userId: auth.user.id,
			error
		})
		return new Response('Failed to load asset', {
			status: 500,
			headers: withNoStoreHeaders(authHeaders)
		})
	}
}
