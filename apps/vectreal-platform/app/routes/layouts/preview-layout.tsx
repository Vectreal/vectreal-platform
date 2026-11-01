import { ApiResponse } from '@shared/utils'
import {
	data,
	Outlet,
	redirect,
	useRouteError,
	type MetaFunction
} from 'react-router'

import { Route } from './+types/preview-layout'
import { RouteErrorState } from '../../components/not-found'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { hasPreviewTokenCredential } from '../../lib/domain/embed/embed-access-policy'
import { buildEmbedPath } from '../../lib/domain/embed/embed-snippet'
import {
	buildDraftFinishManifest,
	buildInlineEmbedManifest,
	EmbedSettingsReadFailure
} from '../../lib/domain/embed/inline-embed-manifest.server'
import { parseSceneRouteParams } from '../../lib/domain/scene/scene-route-params'
import { readEmbedSceneSettings } from '../../lib/domain/scene/server/scene-manifest.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../../lib/domain/scene/server/scene-settings-service.server'
import { getAuthUser } from '../../lib/http/auth.server'
import {
	previewDocumentHeaders,
	withNoStore
} from '../../lib/http/response-headers.server'
import { useErrorReport } from '../../lib/observability/use-error-report'
import { buildMeta } from '../../lib/seo'

import type { SceneEmbedManifestResponse } from '../../types/api'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Preview - Vectreal' },
			{ property: 'og:title', content: 'Preview - Vectreal' }
		],
		undefined,
		{ private: true }
	)

function sceneNotFound() {
	return withNoStore(ApiResponse.notFound('Scene not found'))
}

/**
 * The internal preview authenticates by session and nothing else.
 *
 * A request arriving here with a token is meant for an external embed, so it is
 * redirected to the `/embed` equivalent rather than handled. Keeping exactly one
 * credential type per route is what stops the external URL from ever reaching a
 * surface that renders dashboard chrome.
 *
 * Every refusal is thrown, not returned. A returned response is data to React
 * Router: the page renders, the viewer boots, and only its own fetch fails.
 * Thrown, the boundary below answers with the site's 404 straight away. A
 * malformed id is a 404 too: it names no scene, exactly like an unknown one.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	const parsedParams = parseSceneRouteParams(params)
	if (!parsedParams.ok) {
		throw sceneNotFound()
	}

	const { projectId, sceneId } = parsedParams.value
	const url = new URL(request.url)
	const hasTokenCredential = hasPreviewTokenCredential(request)

	if (hasTokenCredential) {
		return redirect(`${buildEmbedPath({ projectId, sceneId })}${url.search}`)
	}

	const sessionAuth = await getAuthUser(request)
	if (sessionAuth instanceof Response) {
		throw sceneNotFound()
	}

	const membership = await resolveSceneMembership(sceneId, sessionAuth.user.id)
	if (!membership || membership.projectId !== projectId) {
		throw sceneNotFound()
	}

	/*
	  A published scene previews as what a visitor gets: the published GLB and
	  the embed's settings, inline so the model starts loading on hydration.
	  A draft shows the studio finish saved with it while that is current, and
	  otherwise loads the working scene, as it always has.
	*/
	const [previewScene, settingsData, finish] = await Promise.all([
		getPublishedScenePreview(projectId, sceneId),
		readEmbedSceneSettings(sceneId).catch(
			(error: unknown) => new EmbedSettingsReadFailure(error)
		),
		sceneSettingsService.resolveSceneFinish(sceneId).catch(() => null)
	])
	const manifest = previewScene
		? await buildInlineEmbedManifest(request, {
				projectId,
				sceneId,
				previewScene,
				settingsData,
				token: null,
				allowUnsignedWithoutToken: true
			})
		: finish
			? await buildDraftFinishManifest(request, {
					projectId,
					sceneId,
					finish: finish.asset,
					settingsData
				})
			: null

	return data({ projectId, sceneId, manifest })
}

/**
 * A document route keeps only `Set-Cookie` from its loader unless it exports
 * `headers`, so the framing policy is set here; the preview page has no loader
 * and inherits these. A refusal arrives as `errorHeaders`, and gets the same
 * policy.
 */
export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
	return previewDocumentHeaders(errorHeaders ?? loaderHeaders)
}

/**
 * The public error state, owned here so a refusal still passes through
 * `headers` above. Left to the root, React Router stops the header walk at the
 * root route and the 404 goes out without its framing policy.
 *
 * It renders inside the root's normal document, as `/embed`'s boundary does,
 * so the document keeps the app theme and page-view tracking, just as the
 * returned 404 it replaces did. It also catches render errors from the
 * preview page beneath it.
 */
export function ErrorBoundary() {
	const error = useRouteError()
	useErrorReport(error)

	return <RouteErrorState error={error} />
}

/** What the preview route needs from this layout. */
export interface PreviewLayoutContext {
	/**
	 * The published scene's manifest, or a draft's with its saved studio
	 * finish; null for any other draft, or when not inlined.
	 */
	manifest: SceneEmbedManifestResponse | null
}

const PreviewLayout = ({ loaderData }: Route.ComponentProps) => {
	const context: PreviewLayoutContext = {
		// Cast back from the serialized type; see `EmbedLayout`.
		manifest:
			'manifest' in loaderData
				? (loaderData.manifest as SceneEmbedManifestResponse | null)
				: null
	}

	return <Outlet context={context} />
}

export default PreviewLayout
