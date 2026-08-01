import { ApiResponse } from '@shared/utils'
import { data, Outlet, type MetaFunction } from 'react-router'

import { Route } from './+types/embed-layout'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import {
	parseSceneRouteParams,
	SCENE_ROUTE_PARAM_ERRORS
} from '../../lib/domain/scene/scene-route-params'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { buildMeta } from '../../lib/seo'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Embed - Vectreal' },
			{ property: 'og:title', content: 'Embed - Vectreal' }
		],
		undefined,
		{ private: true }
	)

function withNoStoreHeaders(response: Response): Response {
	const headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	return new Response(response.body, {
		status: response.status,
		headers
	})
}

/**
 * External embeds authenticate by preview API key and nothing else.
 *
 * A request without a token gets 404 rather than falling back to session auth,
 * so a signed-in user opening an embed URL sees exactly what an anonymous
 * visitor sees. The internal, session-authenticated view lives at `/preview`.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	const parsedParams = parseSceneRouteParams(params)
	if (!parsedParams.ok) {
		return withNoStoreHeaders(
			ApiResponse.badRequest(SCENE_ROUTE_PARAM_ERRORS[parsedParams.reason])
		)
	}

	const { projectId, sceneId } = parsedParams.value
	const url = new URL(request.url)
	const tokenFromQuery = url.searchParams.get('token')?.trim() || null
	const hasTokenCredential =
		Boolean(tokenFromQuery) || Boolean(request.headers.get('authorization')?.trim())

	if (!hasTokenCredential) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	const authResult = await validatePreviewApiKeyForProject({
		request,
		projectId
	})

	if (!authResult.ok) {
		if (authResult.error === 'rate_limited') {
			return withNoStoreHeaders(ApiResponse.error('Too many requests', 429))
		}
		if (authResult.error === 'domain_not_allowed') {
			return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
		}

		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	const previewScene = await getPublishedScenePreview(projectId, sceneId)
	if (!previewScene) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	return data({
		projectId,
		sceneId,
		tokenFromQuery,
		authenticatedByApiKeyId: authResult.apiKeyId
	})
}

const EmbedLayout = () => {
	return <Outlet />
}

export default EmbedLayout
