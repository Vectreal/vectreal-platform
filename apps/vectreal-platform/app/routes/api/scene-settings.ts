import { OptimizationReport } from '@vctrl/core'
import { ActionFunctionArgs } from 'react-router'

import { ApiResponseBuilder } from '../../lib/api/api-responses.server'
import * as sceneSettingsOps from '../../lib/api/scene-settings-operations.server'
import { SceneSettingsParser } from '../../lib/api/scene-settings-parser.server'
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

	// Get authenticated user
	const authResult = await PlatformApiService.getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	// Parse and validate request data
	const parsedRequest =
		await SceneSettingsParser.parseSceneSettingsRequest(request)
	if (parsedRequest instanceof Response) {
		return parsedRequest
	}

	const { user } = authResult
	const { action, ...requestData } = parsedRequest

	try {
		// Route to appropriate operations
		switch (action as SceneSettingsAction) {
			case 'save-scene-settings':
				return await sceneSettingsOps.saveSceneSettings(
					{
						...requestData,
						action,
						optimizationReport: requestData.optimizationReport as
							| OptimizationReport
							| undefined
					},
					user.id
				)

			case 'get-scene-settings':
				return await sceneSettingsOps.getSceneSettings({
					...requestData,
					action
				})

			default:
				return ApiResponseBuilder.badRequest(`Unknown action: ${action}`)
		}
	} catch (error) {
		console.error('Scene settings operation failed:', error)
		return ApiResponseBuilder.serverError(
			error instanceof Error ? error.message : 'Operation failed'
		)
	}
}
