import { LoaderFunctionArgs } from 'react-router'

import { UUID_REGEX } from '../../constants/utility-constants'
import {
	downloadAsset,
	findSceneThumbnailAsset
} from '../../lib/domain/asset/asset-storage.server'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

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

	/*
	  Authorization gate first, as on the assets route: a non-member gets the
	  same 404 whether or not the thumbnail exists, so the route is no
	  existence oracle. A malformed id names no scene and would fail the uuid
	  cast in Postgres, so it gets that 404 too rather than a 500.

	  Not filtered by `assets.ownerId`: a scene you are entitled to open must
	  show its thumbnail whichever colleague uploaded it.
	*/
	const membership =
		UUID_REGEX.test(sceneId) &&
		(await resolveSceneMembership(sceneId, auth.user.id))
	if (!membership) {
		return new Response('Thumbnail not found', { status: 404, headers })
	}

	// The thumbnail is whatever `scenes.thumbnail_url` names, never the asset
	// row's `metadata.sceneId`: content-hash de-duplication shares one row
	// between scenes, and that field names only the first.
	const thumbnail = await findSceneThumbnailAsset(sceneId, assetId)
	if (!thumbnail) {
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
				responseHeaders.set(
					'Cache-Control',
					'private, max-age=31536000, immutable'
				)
				responseHeaders.set('Last-Modified', thumbnail.updatedAt.toUTCString())
				responseHeaders.set('X-Content-Type-Options', 'nosniff')
				responseHeaders.set('Content-Security-Policy', 'sandbox')
				return responseHeaders
			})()
		})
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { sceneId, assetId, userId: auth.user.id }
		})
		return new Response('Failed to load thumbnail', { status: 500, headers })
	}
}
