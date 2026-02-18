import { ApiResponse } from '@shared/utils'
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

import * as sceneSettingsOps from '../../lib/domain/scene/scene-settings.operations.server'
import { SceneSettingsParser } from '../../lib/domain/scene/scene-settings.parser.server'
import { getScene } from '../../lib/domain/scene/scene-folder-repository.server'
import { sceneSettingsService } from '../../lib/domain/scene/scene-settings-service.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensurePost, parseActionRequest } from '../../lib/http/requests.server'
import type {
	SceneAggregateResponse,
	SceneSettingsAction,
	SceneAssetDataMap,
	SerializedSceneAssetDataMap
} from '../../types/api'

function serializeAssetData(
	assetData: SceneAssetDataMap | null
): SerializedSceneAssetDataMap {
	const serialized: SerializedSceneAssetDataMap = {}

	assetData?.forEach((value, key) => {
		serialized[key] = {
			data: Array.from(value.data),
			mimeType: value.mimeType,
			fileName: value.fileName
		}
	})

	return serialized
}

export async function loader({ request, params }: LoaderFunctionArgs) {
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
		const [settingsResult, stats] = await Promise.all([
			sceneSettingsService.getSceneSettingsWithAssets(sceneId),
			sceneSettingsService.getSceneStats(sceneId)
		])

		if (!settingsResult) {
			const aggregate: SceneAggregateResponse = {
				sceneId,
				stats,
				settings: null,
				gltfJson: null,
				assetData: null,
				assets: null
			}

			return ApiResponse.success(aggregate)
		}

		const aggregate: SceneAggregateResponse = {
			...settingsResult,
			assetData: serializeAssetData(settingsResult.assetDataMap),
			stats
		}

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

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const routeSceneId = params.sceneId?.trim()
	const actionRequest = await parseActionRequest(request.clone())
	const rawAction = actionRequest.action
	const action = typeof rawAction === 'string' ? rawAction.trim() : ''

	if (!action) {
		return ApiResponse.badRequest('Action is required')
	}

	if (action === 'delete' || action === 'duplicate') {
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
