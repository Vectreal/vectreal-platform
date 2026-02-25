import { ApiResponse } from '@shared/utils'
import { Outlet } from 'react-router'

import { Route } from './+types/preview-layout'
import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { getScene } from '../../lib/domain/scene/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/scene-preview-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'

function withNoStoreHeaders(response: Response): Response {
	const headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	return new Response(response.body, {
		status: response.status,
		headers
	})
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId?.trim()
	const sceneId = params.sceneId?.trim()

	if (!projectId || !sceneId) {
		return withNoStoreHeaders(
			ApiResponse.badRequest('Project ID and Scene ID are required')
		)
	}

	const hasTokenCredential =
		Boolean(new URL(request.url).searchParams.get('token')?.trim()) ||
		Boolean(request.headers.get('authorization')?.trim())

	let authMode: 'apiKey' | 'session' | null = null
	let authenticatedByApiKeyId: string | null = null
	let sessionUserId: string | null = null

	if (hasTokenCredential) {
		const authResult = await validatePreviewApiKeyForProject({
			request,
			projectId
		})

		if (!authResult.ok) {
			if (authResult.error === 'rate_limited') {
				return withNoStoreHeaders(ApiResponse.error('Too many requests', 429))
			}

			return withNoStoreHeaders(ApiResponse.unauthorized('Unauthorized'))
		}

		authMode = 'apiKey'
		authenticatedByApiKeyId = authResult.apiKeyId
	} else {
		const sessionAuth = await getAuthUser(request)
		if (sessionAuth instanceof Response) {
			return withNoStoreHeaders(ApiResponse.unauthorized('Unauthorized'))
		}

		const project = await getProject(projectId, sessionAuth.user.id)
		if (!project) {
			return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
		}

		authMode = 'session'
		sessionUserId = sessionAuth.user.id
	}

	if (authMode === 'apiKey') {
		const previewScene = await getPublishedScenePreview(projectId, sceneId)
		if (!previewScene) {
			return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
		}
	} else {
		if (!sessionUserId) {
			return withNoStoreHeaders(ApiResponse.unauthorized('Unauthorized'))
		}

		const scene = await getScene(sceneId, sessionUserId)
		if (!scene || scene.projectId !== projectId) {
			return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
		}
	}

	const url = new URL(request.url)
	const tokenFromQuery = url.searchParams.get('token')?.trim() || null

	return {
		projectId,
		sceneId,
		authMode,
		tokenFromQuery,
		authenticatedByApiKeyId
	}
}

const PreviewLayout = () => {
	return <Outlet />
}

export default PreviewLayout
