import { ApiResponse } from '@shared/utils'
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

import { validatePreviewApiKeyForProject } from '../../lib/domain/auth/preview-api-key-auth.server'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { buildSceneAggregate } from '../../lib/domain/scene/scene-aggregate.server'
import {
	createSceneFolder,
	deleteSceneFolder,
	deleteScene,
	getScene,
	renameSceneFolder,
	renameScene
} from '../../lib/domain/scene/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/scene-preview-repository.server'
import * as sceneSettingsOps from '../../lib/domain/scene/scene-settings.operations.server'
import { SceneSettingsParser } from '../../lib/domain/scene/scene-settings.parser.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensurePost, parseActionRequest } from '../../lib/http/requests.server'

import type {
	ContentActionResponse,
	ContentActionResult,
	ContentItemType,
	SceneAggregateResponse,
	SceneSettingsAction
} from '../../types/api'

function parseActionItems(value: unknown): Array<{ type: string; id: string }> {
	if (Array.isArray(value)) {
		return value.filter(
			(item): item is { type: string; id: string } =>
				typeof item === 'object' &&
				item !== null &&
				typeof (item as { type?: unknown }).type === 'string' &&
				typeof (item as { id?: unknown }).id === 'string'
		)
	}

	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value)
			return parseActionItems(parsed)
		} catch {
			return []
		}
	}

	return []
}

function withNoStoreHeaders(response: Response): Response {
	const headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	return new Response(response.body, {
		status: response.status,
		headers
	})
}

async function authorizePreviewRequest(request: Request, projectId: string) {
	const hasTokenCredential =
		Boolean(new URL(request.url).searchParams.get('token')?.trim()) ||
		Boolean(request.headers.get('authorization')?.trim())

	if (hasTokenCredential) {
		const validation = await validatePreviewApiKeyForProject({
			request,
			projectId
		})

		if (!validation.ok) {
			if (validation.error === 'rate_limited') {
				return withNoStoreHeaders(ApiResponse.error('Too many requests', 429))
			}

			return withNoStoreHeaders(ApiResponse.unauthorized('Unauthorized'))
		}

		return { mode: 'apiKey' as const, userId: null }
	}

	const sessionAuth = await getAuthUser(request)
	if (sessionAuth instanceof Response) {
		return withNoStoreHeaders(ApiResponse.unauthorized('Unauthorized'))
	}

	const project = await getProject(projectId, sessionAuth.user.id)
	if (!project) {
		return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
	}

	return { mode: 'session' as const, userId: sessionAuth.user.id }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const isPreviewRequest = url.searchParams.get('preview') === '1'
	const previewProjectId = url.searchParams.get('projectId')?.trim() || null

	if (isPreviewRequest) {
		const sceneId = params.sceneId?.trim()
		if (!sceneId) {
			return withNoStoreHeaders(ApiResponse.badRequest('Scene ID is required'))
		}

		if (!previewProjectId) {
			return withNoStoreHeaders(
				ApiResponse.badRequest('Project ID is required')
			)
		}

		const authContext = await authorizePreviewRequest(request, previewProjectId)
		if (authContext instanceof Response) {
			return authContext
		}

		if (authContext.mode === 'apiKey') {
			const previewScene = await getPublishedScenePreview(
				previewProjectId,
				sceneId
			)
			if (!previewScene) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
		} else {
			const scene = await getScene(sceneId, authContext.userId)
			if (!scene || scene.projectId !== previewProjectId) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
		}

		try {
			const aggregate: SceneAggregateResponse =
				await buildSceneAggregate(sceneId)

			return withNoStoreHeaders(ApiResponse.success(aggregate))
		} catch (error) {
			console.error('Failed to load preview scene aggregate:', {
				sceneId,
				projectId: previewProjectId,
				error
			})
			return withNoStoreHeaders(ApiResponse.serverError('Failed to load scene'))
		}
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const sceneId = params.sceneId?.trim()
	if (!sceneId) {
		return ApiResponse.badRequest('Scene ID is required')
	}

	const scene = await getScene(sceneId, authResult.user.id)
	if (!scene) {
		return ApiResponse.notFound(`Scene not found with ID: ${sceneId}`)
	}

	try {
		const aggregate: SceneAggregateResponse = await buildSceneAggregate(sceneId)

		return ApiResponse.success(aggregate)
	} catch (error) {
		console.error('Failed to load scene aggregate:', {
			sceneId,
			userId: authResult.user.id,
			error
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to load scene'
		)
	}
}

export async function action({ request, params }: ActionFunctionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) return methodCheck

	const url = new URL(request.url)
	const isPreviewRequest = url.searchParams.get('preview') === '1'
	const previewProjectId = url.searchParams.get('projectId')?.trim() || null

	const routeSceneId = params.sceneId?.trim()
	const actionRequest = await parseActionRequest(request.clone())
	const rawAction = actionRequest.action
	const action = typeof rawAction === 'string' ? rawAction.trim() : ''

	if (!action) {
		return ApiResponse.badRequest('Action is required')
	}

	if (isPreviewRequest) {
		if (action !== 'get-scene-settings') {
			return withNoStoreHeaders(ApiResponse.forbidden('Forbidden'))
		}

		if (!routeSceneId) {
			return withNoStoreHeaders(ApiResponse.badRequest('Scene ID is required'))
		}

		if (!previewProjectId) {
			return withNoStoreHeaders(
				ApiResponse.badRequest('Project ID is required')
			)
		}

		const authContext = await authorizePreviewRequest(request, previewProjectId)
		if (authContext instanceof Response) {
			return authContext
		}

		if (authContext.mode === 'apiKey') {
			const previewScene = await getPublishedScenePreview(
				previewProjectId,
				routeSceneId
			)
			if (!previewScene) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
		} else {
			const scene = await getScene(routeSceneId, authContext.userId)
			if (!scene || scene.projectId !== previewProjectId) {
				return withNoStoreHeaders(ApiResponse.notFound('Scene not found'))
			}
		}

		const parsedRequest = await SceneSettingsParser.parseSceneSettingsRequest(
			request.clone()
		)
		if (parsedRequest instanceof Response) {
			return withNoStoreHeaders(parsedRequest)
		}

		const response = await sceneSettingsOps.getSceneSettings({
			...parsedRequest,
			action,
			sceneId: parsedRequest.sceneId?.trim() || routeSceneId
		})

		return withNoStoreHeaders(response)
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	if (action === 'create-folder') {
		const projectIdRaw = actionRequest.projectId
		const nameRaw = actionRequest.name
		const descriptionRaw = actionRequest.description
		const parentFolderIdRaw = actionRequest.parentFolderId

		const projectId =
			typeof projectIdRaw === 'string' ? projectIdRaw.trim() : ''
		const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
		const description =
			typeof descriptionRaw === 'string' ? descriptionRaw.trim() : ''
		const parentFolderId =
			typeof parentFolderIdRaw === 'string' && parentFolderIdRaw.trim()
				? parentFolderIdRaw.trim()
				: null

		if (!projectId) {
			return ApiResponse.badRequest('Project ID is required')
		}

		if (!name) {
			return ApiResponse.badRequest('Folder name is required')
		}

		try {
			const folder = await createSceneFolder({
				projectId,
				userId: authResult.user.id,
				name,
				description,
				parentFolderId
			})

			return ApiResponse.success({
				success: true,
				action,
				folder
			})
		} catch (error) {
			return ApiResponse.serverError(
				error instanceof Error ? error.message : 'Failed to create folder'
			)
		}
	}

	if (action === 'delete' || action === 'rename') {
		if (routeSceneId === 'bulk') {
			const items = parseActionItems(actionRequest.items)
			if (items.length === 0) {
				return ApiResponse.badRequest('At least one item is required')
			}

			const results: ContentActionResult[] = []
			const name =
				typeof actionRequest.name === 'string' ? actionRequest.name : ''

			for (const item of items) {
				if (item.type !== 'scene' && item.type !== 'folder') {
					results.push({
						type: 'scene',
						id: item.id,
						success: false,
						error: 'Unsupported item type'
					})
					continue
				}

				try {
					if (action === 'delete') {
						if (item.type === 'scene') {
							await deleteScene(item.id, authResult.user.id)
						} else {
							await deleteSceneFolder(item.id, authResult.user.id)
						}
					}

					if (action === 'rename') {
						if (!name.trim()) {
							throw new Error('Name is required for rename')
						}

						if (item.type === 'scene') {
							await renameScene(item.id, authResult.user.id, name)
						} else {
							await renameSceneFolder(item.id, authResult.user.id, name)
						}
					}

					results.push({
						type: item.type as ContentItemType,
						id: item.id,
						success: true
					})
				} catch (error) {
					results.push({
						type: item.type as ContentItemType,
						id: item.id,
						success: false,
						error: error instanceof Error ? error.message : 'Action failed'
					})
				}
			}

			const succeeded = results.filter((result) => result.success).length
			const response: ContentActionResponse = {
				success: succeeded > 0,
				action,
				results,
				summary: {
					total: results.length,
					succeeded,
					failed: results.length - succeeded
				}
			}

			return ApiResponse.success(response)
		}

		if (!routeSceneId) {
			return ApiResponse.badRequest('Scene ID is required')
		}

		const scene = await getScene(routeSceneId, authResult.user.id)
		if (!scene) {
			return ApiResponse.notFound(`Scene not found with ID: ${routeSceneId}`)
		}

		try {
			if (action === 'delete') {
				await deleteScene(routeSceneId, authResult.user.id)
			}

			if (action === 'rename') {
				const name =
					typeof actionRequest.name === 'string' ? actionRequest.name : ''
				if (!name.trim()) {
					return ApiResponse.badRequest('Name is required for rename')
				}
				await renameScene(routeSceneId, authResult.user.id, name)
			}

			return ApiResponse.success({
				success: true,
				action,
				sceneId: routeSceneId
			})
		} catch (error) {
			return ApiResponse.serverError(
				error instanceof Error ? error.message : 'Action failed'
			)
		}
	}

	if (action === 'duplicate') {
		if (!routeSceneId) {
			return ApiResponse.badRequest('Scene ID is required')
		}

		const scene = await getScene(routeSceneId, authResult.user.id)
		if (!scene) {
			return ApiResponse.notFound(`Scene not found with ID: ${routeSceneId}`)
		}

		return ApiResponse.success({
			success: true,
			message: `${action} action accepted`,
			action,
			sceneId: routeSceneId
		})
	}

	const parsedRequest = await SceneSettingsParser.parseSceneSettingsRequest(
		request.clone()
	)
	if (parsedRequest instanceof Response) {
		return parsedRequest
	}

	const effectiveSceneId = parsedRequest.sceneId?.trim() || routeSceneId
	const requestData = {
		...parsedRequest,
		sceneId: effectiveSceneId
	}

	if (
		effectiveSceneId &&
		(action === 'save-scene-settings' ||
			action === 'get-scene-settings' ||
			action === 'publish-scene')
	) {
		const scene = await getScene(effectiveSceneId, authResult.user.id)
		if (!scene) {
			return ApiResponse.notFound(
				`Scene not found with ID: ${effectiveSceneId}`
			)
		}
	}

	if (action === 'save-scene-settings') {
		console.info('[scenes] save request received', {
			requestId: requestData.requestId,
			userId: authResult.user.id,
			sceneId: requestData.sceneId || null
		})
	}

	try {
		switch (action as SceneSettingsAction) {
			case 'save-scene-settings':
				return await sceneSettingsOps.saveSceneSettings(
					{
						...requestData,
						action
					},
					authResult.user.id
				)

			case 'get-scene-settings':
				return await sceneSettingsOps.getSceneSettings({
					...requestData,
					action
				})

			case 'publish-scene':
				return await sceneSettingsOps.publishScene(
					{
						...requestData,
						action
					},
					authResult.user.id
				)

			default:
				return ApiResponse.badRequest(`Unknown action: ${action}`)
		}
	} catch (error) {
		console.error('Scene operation failed:', {
			action,
			requestId: requestData.requestId,
			userId: authResult.user.id,
			sceneId: requestData.sceneId || null,
			error
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Operation failed'
		)
	}
}
