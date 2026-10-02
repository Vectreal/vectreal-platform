import { data, Outlet, useRouteError, type MetaFunction } from 'react-router'

import { Route } from './+types/embed-layout'
import { EmbedErrorState } from '../../components/scene-embed/embed-error-state'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { hasEntitlement } from '../../lib/domain/billing/entitlement-service.server'
import {
	resolveEmbedBranding,
	shouldShowVectrealBranding
} from '../../lib/domain/embed/embed-branding-policy'
import { embedRefusal } from '../../lib/domain/embed/embed-refusal'
import {
	EMBED_RESPONSE_HEADERS,
	mergeEmbedResponseHeaders
} from '../../lib/domain/embed/embed-response-headers'
import { parseSceneRouteParams } from '../../lib/domain/scene/scene-route-params'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { embedErrorKind } from '../../lib/errors/error-state-copy'
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
		throw embedRefusal('not_available', 400)
	}

	const { projectId, sceneId } = parsedParams.value
	const url = new URL(request.url)
	const tokenFromQuery = url.searchParams.get('token')?.trim() || null
	const hasTokenCredential =
		Boolean(tokenFromQuery) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (!hasTokenCredential) {
		throw embedRefusal('not_available')
	}

	const authResult = await validatePreviewApiKeyForProject({
		request,
		projectId
	})

	if (!authResult.ok) {
		if (authResult.error === 'rate_limited') {
			throw embedRefusal('busy')
		}
		if (authResult.error === 'domain_not_allowed') {
			/*
			  Safe to explain, unlike every other refusal here. This one is only
			  reached after a live key matched this project, so the caller has
			  already proved they hold it - and it fires before the scene is looked
			  up, so it discloses nothing about whether that scene exists. The
			  others stay a flat 404 for exactly that reason.
			*/
			throw embedRefusal('domain_not_allowed')
		}

		throw embedRefusal('not_available')
	}

	const previewScene = await getPublishedScenePreview(projectId, sceneId)
	if (!previewScene) {
		throw embedRefusal('not_available')
	}

	/*
	  The success path carried no headers at all until now, so it was the one
	  response a crawler could actually reach and index, and the only one not
	  marked `no-store` - while being the only one whose body embeds the token
	  and the id of the key that authorized it.
	*/
	/*
	  Resolved here rather than in the scene manifest, for two reasons. This is
	  the only response on the embed path that already knows the owning
	  organization - the key lookup selects it and `decideEmbedAccess` compares
	  it - so nothing extra is queried. And these headers are `no-store`, while
	  the manifest is cached against an ETag keyed on the scene and its last
	  save; putting a plan answer behind that tag would leave an org that
	  upgrades serving the old one until it next edited the scene.
	*/
	const brandingRemoval = await hasEntitlement(
		authResult.organizationId,
		'embed_branding_removal'
	)

	return data(
		{
			projectId,
			sceneId,
			tokenFromQuery,
			authenticatedByApiKeyId: authResult.apiKeyId,
			showsVectrealBranding: shouldShowVectrealBranding(brandingRemoval)
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
	return mergeEmbedResponseHeaders(loaderHeaders)
}

/**
 * Every embed failure, rendered inside the customer's iframe.
 *
 * It no longer re-throws to the root, whose boundary is the marketing site's
 * error page: that would load our nav-free hero, and its links, into somebody
 * else's page. Refusals the loader threw on purpose stay unreported, because
 * the status floor in `buildErrorReport` drops every response below 500; a
 * real fault is reported.
 *
 * Retrying reloads the iframe, which is the whole embed.
 */
export function ErrorBoundary() {
	const error = useRouteError()
	useErrorReport(error)

	return (
		<EmbedErrorState
			kind={embedErrorKind(error)}
			onRetry={() => window.location.reload()}
		/>
	)
}

/**
 * What the embed route needs from this layout.
 *
 * Passed as outlet context rather than read back with `useRouteLoaderData`,
 * matching how the auth layout hands its children the Turnstile token: the
 * child states the shape it needs and the compiler checks the layout supplies
 * it, which a route-id string lookup cannot do.
 */
export interface EmbedLayoutContext {
	/**
	 * Whether this embed carries the Vectreal mark, decided from the plan of
	 * the organization that owns the scene. Only `/embed` resolves it; the
	 * internal `/preview` renders no mark at all.
	 */
	showsVectrealBranding: boolean
}

const EmbedLayout = ({ loaderData }: Route.ComponentProps) => {
	const context: EmbedLayoutContext = {
		showsVectrealBranding: resolveEmbedBranding(loaderData)
	}

	return <Outlet context={context} />
}

export default EmbedLayout
