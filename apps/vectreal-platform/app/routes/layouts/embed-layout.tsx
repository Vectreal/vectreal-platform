import { data, Outlet, useRouteError, type MetaFunction } from 'react-router'

import { Route } from './+types/embed-layout'
import { EmbedErrorState } from '../../components/scene-embed/embed-error-state'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { hasEntitlement } from '../../lib/domain/billing/entitlement-service.server'
import { createEmbedAssetUrls } from '../../lib/domain/embed/embed-asset-signature.server'
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
import {
	composeEmbedSceneManifest,
	readEmbedSceneSettings,
	type EmbedSceneSettings
} from '../../lib/domain/scene/server/scene-manifest.server'
import {
	getPublishedScenePreview,
	toPublishedModelRow,
	type PublishedScenePreview
} from '../../lib/domain/scene/server/scene-preview-repository.server'
import { embedErrorKind } from '../../lib/errors/error-state-copy'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { useErrorReport } from '../../lib/observability/use-error-report'
import { buildMeta } from '../../lib/seo'

import type { SceneEmbedManifestResponse } from '../../types/api'

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
class EmbedSettingsReadFailure {
	constructor(readonly cause: unknown) {}
}

/**
 * The scene manifest, served with the document so the embed starts loading
 * the model the moment it hydrates instead of asking for the manifest first -
 * a round trip that also repeated the key check and the publication lookup
 * this loader had just done.
 *
 * Null when it cannot be served inline, and the client then fetches it the
 * way it always has: when building it fails, or when its asset URLs would
 * need the key as a header, which an inline load does not send - unsigned
 * URLs carry the key only when it arrived in the query.
 */
async function buildInlineEmbedManifest(
	request: Request,
	params: {
		projectId: string
		sceneId: string
		previewScene: PublishedScenePreview
		settingsData: EmbedSceneSettings | EmbedSettingsReadFailure
		token: string | null
	}
): Promise<SceneEmbedManifestResponse | null> {
	const { projectId, sceneId, previewScene, settingsData, token } = params
	const assetUrls = createEmbedAssetUrls({ sceneId, projectId, token })
	if (assetUrls.version === null && !token) return null

	try {
		if (settingsData instanceof EmbedSettingsReadFailure) {
			throw settingsData.cause
		}
		return await composeEmbedSceneManifest(
			sceneId,
			toPublishedModelRow(previewScene),
			settingsData,
			assetUrls.buildAssetUrl
		)
	} catch (error) {
		reportServerError(error, { request, properties: { sceneId, projectId } })
		return null
	}
}

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

	/*
	  Read together rather than in turn: each depends only on what the key
	  check already established. The settings are read before the scene is
	  known to be published and dropped unread if it is not, so a refusal
	  costs one query and discloses nothing.

	  The branding answer stays here rather than in the manifest, because this
	  is the only response on the embed path that already knows the owning
	  organization - the key lookup selects it and `decideEmbedAccess` compares
	  it - and because these headers are `no-store`, while the manifest is
	  cached against an ETag keyed on the scene; putting a plan answer behind
	  that tag would leave an org that upgrades serving the old one until it
	  next edited the scene.
	*/
	const [previewScene, settingsData, brandingRemoval] = await Promise.all([
		getPublishedScenePreview(projectId, sceneId),
		readEmbedSceneSettings(sceneId).catch(
			(error: unknown) => new EmbedSettingsReadFailure(error)
		),
		hasEntitlement(authResult.organizationId, 'embed_branding_removal')
	])
	if (!previewScene) {
		throw embedRefusal('not_available')
	}

	const manifest = await buildInlineEmbedManifest(request, {
		projectId,
		sceneId,
		previewScene,
		settingsData,
		token: tokenFromQuery
	})

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
			authenticatedByApiKeyId: authResult.apiKeyId,
			showsVectrealBranding: shouldShowVectrealBranding(brandingRemoval),
			manifest
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
	/** The scene manifest, when the document could carry it. */
	manifest: SceneEmbedManifestResponse | null
}

const EmbedLayout = ({ loaderData }: Route.ComponentProps) => {
	const context: EmbedLayoutContext = {
		showsVectrealBranding: resolveEmbedBranding(loaderData),
		/*
		  Cast back from the serialized type, which strips the methods off the
		  three.js types `SceneSettings` names (a `Vector3` position, say). The
		  value never had any: settings are stored as JSON and were plain data
		  before they were ever serialized.
		*/
		manifest: loaderData.manifest as SceneEmbedManifestResponse | null
	}

	return <Outlet context={context} />
}

export default EmbedLayout
