import { ApiResponse } from '@shared/utils'
import { data, Outlet, type MetaFunction } from 'react-router'

import { Route } from './+types/embed-layout'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import {
	EMBED_RESPONSE_HEADERS,
	withEmbedResponseHeaders
} from '../../lib/domain/embed/embed-response-headers'
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
		return withEmbedResponseHeaders(
			ApiResponse.badRequest(SCENE_ROUTE_PARAM_ERRORS[parsedParams.reason])
		)
	}

	const { projectId, sceneId } = parsedParams.value
	const url = new URL(request.url)
	const tokenFromQuery = url.searchParams.get('token')?.trim() || null
	const hasTokenCredential =
		Boolean(tokenFromQuery) || Boolean(request.headers.get('authorization')?.trim())

	if (!hasTokenCredential) {
		return withEmbedResponseHeaders(ApiResponse.notFound('Scene not found'))
	}

	const authResult = await validatePreviewApiKeyForProject({
		request,
		projectId
	})

	if (!authResult.ok) {
		if (authResult.error === 'rate_limited') {
			return withEmbedResponseHeaders(ApiResponse.error('Too many requests', 429))
		}
		if (authResult.error === 'domain_not_allowed') {
			return withEmbedResponseHeaders(ApiResponse.forbidden('Forbidden'))
		}

		return withEmbedResponseHeaders(ApiResponse.notFound('Scene not found'))
	}

	const previewScene = await getPublishedScenePreview(projectId, sceneId)
	if (!previewScene) {
		return withEmbedResponseHeaders(ApiResponse.notFound('Scene not found'))
	}

	/*
	  The success path carried no headers at all until now, so it was the one
	  response a crawler could actually reach and index, and the only one not
	  marked `no-store` - while being the only one whose body embeds the token
	  and the id of the key that authorized it.
	*/
	return data(
		{
			projectId,
			sceneId,
			tokenFromQuery,
			authenticatedByApiKeyId: authResult.apiKeyId
		},
		{ headers: EMBED_RESPONSE_HEADERS }
	)
}

/**
 * Without this the headers above never reach the browser.
 *
 * `/embed/:projectId/:sceneId` renders a document, so React Router builds the
 * HTTP response through `getDocumentHeaders`. For any route module with no
 * `headers` export it takes `new Headers(parentHeaders)` and then merges only
 * `Set-Cookie` from the loader - every other header the loader set is dropped
 * on the floor. `Cache-Control`, `X-Robots-Tag` and `Referrer-Policy` all
 * qualify, so the loader would have been setting them into nothing.
 *
 * No other route in this app exports `headers`, which is why it looks
 * unnecessary and is not. The child route has no loader of its own, so it falls
 * through to `new Headers(parentHeaders)` and passes these along unchanged.
 */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
	return loaderHeaders
}

const EmbedLayout = () => {
	return <Outlet />
}

export default EmbedLayout
