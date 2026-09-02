import { ApiResponse } from '@shared/utils'
import {
	data,
	isRouteErrorResponse,
	Outlet,
	useRouteError,
	type MetaFunction
} from 'react-router'

import { Route } from './+types/embed-layout'
import { EmbedRefusal } from '../../components/scene-embed/embed-refusal'
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
import { useErrorReport } from '../../lib/observability/use-error-report'
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
		Boolean(tokenFromQuery) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (!hasTokenCredential) {
		return withEmbedResponseHeaders(ApiResponse.notFound('Scene not found'))
	}

	const authResult = await validatePreviewApiKeyForProject({
		request,
		projectId
	})

	if (!authResult.ok) {
		if (authResult.error === 'rate_limited') {
			return withEmbedResponseHeaders(
				ApiResponse.error('Too many requests', 429)
			)
		}
		if (authResult.error === 'domain_not_allowed') {
			/*
			  Thrown, not returned. A returned `Response` is data to React Router:
			  no boundary runs, the document renders at 403 with a payload nothing
			  reads, and the viewer boots into a spinner and then a generic "unable
			  to load" with a Retry that retries nothing. Throwing is what puts the
			  explanation on screen.

			  Safe to explain, unlike every other refusal here. This one is only
			  reached after a live key matched this project, so the caller has
			  already proved they hold it - and it fires before the scene is looked
			  up, so it discloses nothing about whether that scene exists. The
			  others stay a flat 404 for exactly that reason.
			*/
			throw data(
				{ reason: 'domain_not_allowed' as const },
				{ status: 403, headers: EMBED_RESPONSE_HEADERS }
			)
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

/**
 * The refusal an owner can act on, rendered instead of a broken viewer.
 *
 * Only `domain_not_allowed` gets a message; anything else falls through to the
 * generic boundary, because the other refusals are the ones that must not say
 * which of them happened.
 *
 * `headers` above does not run for a thrown response - React Router builds the
 * error response separately - so the status carries the headers itself, from
 * the same constant the success path uses.
 */
export function ErrorBoundary() {
	const error = useRouteError()
	const isRefusal =
		isRouteErrorResponse(error) &&
		error.status === 403 &&
		error.data?.reason === 'domain_not_allowed'

	/*
	  Called unconditionally, because a boundary is a component and the hook
	  cannot move inside an `if` - and passed `undefined` for the refusal, which
	  the hook documents as reporting nothing.

	  That distinction is the point rather than a way around the ratchet. A
	  refused domain is a decision this route made on purpose, and the site that
	  triggers it will trigger it on every page load; reporting it would fill the
	  exception feed with the one failure already visible on screen. Anything
	  else reaching here is a real error and is reported before it is re-thrown.
	*/
	useErrorReport(isRefusal ? undefined : error)

	if (isRefusal) {
		return <EmbedRefusal reason="domain_not_allowed" />
	}

	/*
	  Re-thrown so the root boundary renders it. This route only knows how to
	  explain one thing; the rest are not its to present.
	*/
	throw error
}

const EmbedLayout = () => {
	return <Outlet />
}

export default EmbedLayout
