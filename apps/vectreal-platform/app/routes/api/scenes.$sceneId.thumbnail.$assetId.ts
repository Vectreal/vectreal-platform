import { eq } from 'drizzle-orm'
import { LoaderFunctionArgs } from 'react-router'

import { getDbClient } from '../../db/client'
import { assets } from '../../db/schema'
import { downloadAsset } from '../../lib/domain/asset/asset-storage.server'
import { getScene } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'

const db = getDbClient()

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

export async function loader({ request, params }: LoaderFunctionArgs) {
	const auth = await getAuthUser(request)
	if (auth instanceof Response) {
		return auth
	}

	const sceneId = params.sceneId?.trim()
	const assetId = params.assetId?.trim()
	const headers = auth.headers ?? {}

	if (!sceneId || !assetId) {
		return new Response('Missing scene or asset ID', {
			status: 400,
			headers
		})
	}

	// Deliberately not filtered by `assets.ownerId`. Access to a thumbnail is
	// decided by access to the scene it belongs to, which the two checks below
	// establish: the metadata binds the asset to this scene, and `getScene` runs
	// `verifyProjectAccess` for the requesting user. Requiring ownership on top
	// of that was strictly narrower and broke teams - a scene you are entitled to
	// open returned 404 for its thumbnail whenever a colleague had uploaded it.
	const [asset] = await db
		.select({
			id: assets.id,
			ownerId: assets.ownerId,
			metadata: assets.metadata,
			updatedAt: assets.updatedAt
		})
		.from(assets)
		.where(eq(assets.id, assetId))
		.limit(1)

	if (!asset) {
		return new Response('Thumbnail not found', { status: 404, headers })
	}

	const metadata = asset.metadata as { sceneId?: unknown } | null
	if (metadata?.sceneId !== sceneId) {
		return new Response('Thumbnail not found', { status: 404, headers })
	}

	// `getScene` returns null for a missing scene but *throws* from
	// `verifyProjectAccess` when the user is not a member of the owning org.
	// Both mean the same thing to a caller who should not see this image, and
	// both must answer 404 rather than leaking the distinction - or, worse,
	// surfacing an unhandled error. While the query above still filtered on
	// `ownerId`, a non-member never reached this line.
	let scene: Awaited<ReturnType<typeof getScene>> = null
	try {
		scene = await getScene(sceneId, auth.user.id)
	} catch {
		scene = null
	}

	if (!scene) {
		return new Response('Thumbnail not found', { status: 404, headers })
	}

	try {
		const assetData = await downloadAsset(assetId)
		const body = new Blob([Buffer.from(assetData.data)], {
			type: sanitizeMimeType(assetData.mimeType)
		})

		return new Response(body, {
			status: 200,
			headers: (() => {
				const responseHeaders = new Headers(headers)
				responseHeaders.set(
					'Content-Type',
					sanitizeMimeType(assetData.mimeType)
				)
				responseHeaders.set('Cache-Control', 'private, max-age=31536000, immutable')
				responseHeaders.set(
					'Last-Modified',
					asset.updatedAt.toUTCString()
				)
				responseHeaders.set('X-Content-Type-Options', 'nosniff')
				responseHeaders.set('Content-Security-Policy', 'sandbox')
				return responseHeaders
			})()
		})
	} catch (error) {
		console.error('Failed to stream thumbnail asset', {
			sceneId,
			assetId,
			userId: auth.user.id,
			error
		})
		return new Response('Failed to load thumbnail', { status: 500, headers })
	}
}
