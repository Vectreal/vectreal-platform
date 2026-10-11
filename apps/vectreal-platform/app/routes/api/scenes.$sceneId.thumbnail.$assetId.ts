import { LoaderFunctionArgs } from 'react-router'

import {
	downloadAsset,
	findAssetMetadata
} from '../../lib/domain/asset/asset-storage.server'
import { getScene } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { assetResponse } from '../../lib/http/asset-response.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'

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
	const asset = await findAssetMetadata(assetId)

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
		const responseHeaders = new Headers(headers)
		responseHeaders.set('Last-Modified', asset.updatedAt.toUTCString())

		return assetResponse(assetData.data, assetData.mimeType, responseHeaders)
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { sceneId, assetId, userId: auth.user.id }
		})
		return new Response('Failed to load thumbnail', { status: 500, headers })
	}
}
