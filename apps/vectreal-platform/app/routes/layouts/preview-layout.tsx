import { ApiResponse } from '@shared/utils'
import { data, Outlet, redirect, type MetaFunction } from 'react-router'

import { Route } from './+types/preview-layout'
import { buildEmbedPath } from '../../lib/domain/embed/embed-snippet'
import { getProject } from '../../lib/domain/project/project-repository.server'
import {
	parseSceneRouteParams,
	SCENE_ROUTE_PARAM_ERRORS
} from '../../lib/domain/scene/scene-route-params'
import { getScene } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { buildMeta } from '../../lib/seo'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Preview - Vectreal' },
			{ property: 'og:title', content: 'Preview - Vectreal' }
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
		return withNoStoreHeaders(
			ApiResponse.badRequest(SCENE_ROUTE_PARAM_ERRORS[parsedParams.reason])
		)
	}

	const { projectId, sceneId } = parsedParams.value
	const url = new URL(request.url)
	const hasTokenCredential =
		Boolean(url.searchParams.get('token')?.trim()) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (hasTokenCredential) {
		return redirect(
			`${buildEmbedPath({ projectId, sceneId })}${url.search}`
		)
	}

	const sessionAuth = await getAuthUser(request)
	if (sessionAuth instanceof Response) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	const project = await getProject(projectId, sessionAuth.user.id)
	if (!project) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	const scene = await getScene(sceneId, sessionAuth.user.id)
	if (!scene || scene.projectId !== projectId) {
		return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
	}

	return data(
		{ projectId, sceneId },
		{ headers: sessionAuth.headers ?? {} }
	)
}

const PreviewLayout = () => {
	return <Outlet />
}

export default PreviewLayout
