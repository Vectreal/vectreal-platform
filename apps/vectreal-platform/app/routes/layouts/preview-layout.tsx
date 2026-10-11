import { ApiResponse } from '@shared/utils'
import { data, Outlet, redirect, type MetaFunction } from 'react-router'

import { Route } from './+types/preview-layout'
import { resolveSceneMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { buildEmbedPath } from '../../lib/domain/embed/embed-snippet'
import {
	buildInlineEmbedManifest,
	EmbedSettingsReadFailure
} from '../../lib/domain/embed/inline-embed-manifest.server'
import {
	parseSceneRouteParams,
	SCENE_ROUTE_PARAM_ERRORS
} from '../../lib/domain/scene/scene-route-params'
import { readEmbedSceneSettings } from '../../lib/domain/scene/server/scene-manifest.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { withNoStore } from '../../lib/http/response-headers.server'
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

/**
 * The internal preview authenticates by session and nothing else.
 *
 * A request arriving here with a token is meant for an external embed, so it is
 * redirected to the `/embed` equivalent rather than handled. Keeping exactly one
 * credential type per route is what stops the external URL from ever reaching a
 * surface that renders dashboard chrome.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	const parsedParams = parseSceneRouteParams(params)
	if (!parsedParams.ok) {
		return withNoStore(
			ApiResponse.badRequest(SCENE_ROUTE_PARAM_ERRORS[parsedParams.reason])
		)
	}

	const { projectId, sceneId } = parsedParams.value
	const url = new URL(request.url)
	const hasTokenCredential =
		Boolean(url.searchParams.get('token')?.trim()) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (hasTokenCredential) {
		return redirect(`${buildEmbedPath({ projectId, sceneId })}${url.search}`)
	}

	const sessionAuth = await getAuthUser(request)
	if (sessionAuth instanceof Response) {
		return withNoStore(ApiResponse.notFound('Scene not found'))
	}

	const membership = await resolveSceneMembership(sceneId, sessionAuth.user.id)
	if (!membership || membership.projectId !== projectId) {
		return withNoStore(ApiResponse.notFound('Scene not found'))
	}

	/*
	  A published scene previews as what a visitor gets: the published GLB and
	  the embed's settings, inline so the model starts loading on hydration.
	  A draft has no such artefact and loads the working scene, as it always
	  has. The settings are read alongside the publication and dropped unread
	  for a draft, the way `/embed` reads them.
	*/
	const [previewScene, settingsData] = await Promise.all([
		getPublishedScenePreview(projectId, sceneId),
		readEmbedSceneSettings(sceneId).catch(
			(error: unknown) => new EmbedSettingsReadFailure(error)
		)
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
		: null

	return data(
		{ projectId, sceneId, manifest },
		{ headers: sessionAuth.headers ?? {} }
	)
}

/** What the preview route needs from this layout. */
export interface PreviewLayoutContext {
	/** The published scene's manifest; null for a draft, or when not inlined. */
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
