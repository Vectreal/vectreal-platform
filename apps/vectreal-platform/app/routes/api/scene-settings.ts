import { ActionFunctionArgs } from 'react-router'

import { ApiResponseBuilder } from '../../lib/api/api-responses'
import * as sceneSettingsOps from '../../lib/api/scene-settings-operations'
import { SceneSettingsParser } from '../../lib/api/scene-settings-parser'
import { PlatformApiService } from '../../lib/services/platform-api-service.server'

import type { SceneSettingsAction } from '../../types/api'

/**
 * Handles scene settings API requests.
 * @param request - The HTTP request
 * @returns API response
 */
export async function action({ request }: ActionFunctionArgs) {
	// Ensure POST method
	const methodCheck = PlatformApiService.ensurePost(request)
	if (methodCheck) return methodCheck

	// Parse and validate request data
	const parsedRequest =
		await SceneSettingsParser.parseSceneSettingsRequest(request)
	if (parsedRequest instanceof Response) {
		return parsedRequest
	}

	// Get authenticated user
	const authResult = await PlatformApiService.getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const { user } = authResult
	const { action: actionType, ...requestData } = parsedRequest

	console.log('Scene settings request - action:', actionType)
	console.log('Scene settings request - sceneId:', requestData.sceneId)
	console.log(
		'Scene settings request - settings keys:',
		Object.keys(requestData.settings)
	)
	console.log(
		'Scene settings request - assetIds count:',
		requestData.assetIds.length
	)

	try {
		// Route to appropriate operations
		switch (actionType as SceneSettingsAction) {
			case 'save-scene-settings': {
				const result = await sceneSettingsOps.saveSceneSettingsWithValidation(
					{ ...requestData, action: actionType },
					user.id
				)
				return result
			}

			case 'get-scene-settings': {
				const result = await sceneSettingsOps.getSceneSettingsWithValidation(
					{ ...requestData, action: actionType },
					user.id
				)
				return result
			}

			default:
				return ApiResponseBuilder.badRequest(`Unknown action: ${actionType}`)
		}
	} catch (error) {
		console.error('Scene settings operation failed:', error)
		return ApiResponseBuilder.serverError(
			error instanceof Error ? error.message : 'Operation failed'
		)
	}
}
