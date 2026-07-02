import { and, eq } from 'drizzle-orm'
import { LoaderFunctionArgs } from 'react-router'

import { getDbClient } from '../../db/client'
import { assets } from '../../db/schema'
import { downloadAsset } from '../../lib/domain/asset/asset-storage.server'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { getScene } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'

const db = getDbClient()

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
		if (!previewScene) {
			return new Response('Asset not found', {
				status: 404,
				headers: withNoStoreHeaders()
			})
		}

		const [asset] = await db
			.select({ id: assets.id, metadata: assets.metadata })
			.from(assets)
			.where(eq(assets.id, assetId))
			.limit(1)

		const metadata = asset?.metadata as { sceneId?: unknown } | null
		if (!asset || metadata?.sceneId !== sceneId) {
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

	const [asset] = await db
		.select({ id: assets.id, metadata: assets.metadata })
		.from(assets)
		.where(and(eq(assets.id, assetId), eq(assets.ownerId, auth.user.id)))
		.limit(1)

	const metadata = asset?.metadata as { sceneId?: unknown } | null
	if (!asset || metadata?.sceneId !== sceneId) {
		return new Response('Asset not found', {
			status: 404,
			headers: withNoStoreHeaders(authHeaders)
		})
	}

	const scene = await getScene(sceneId, auth.user.id)
	if (!scene) {
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
