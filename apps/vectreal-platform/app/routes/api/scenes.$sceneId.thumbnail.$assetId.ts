import { LoaderFunctionArgs } from 'react-router'

import { UUID_REGEX } from '../../constants/utility-constants'
import {
	downloadAsset,
	findSceneThumbnailAsset
} from '../../lib/domain/asset/asset-storage.server'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
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
		const responseHeaders = new Headers(headers)
		responseHeaders.set('Last-Modified', thumbnail.updatedAt.toUTCString())

		return assetResponse(assetData.data, assetData.mimeType, responseHeaders)
	} catch (error) {
		reportServerError(error, {
			request,
			properties: { sceneId, assetId, userId: auth.user.id }
		})
		return new Response('Failed to load thumbnail', { status: 500, headers })
	}
}
