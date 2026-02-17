import { ApiResponse } from '@shared/utils'
import { OptimizationReport } from '@vctrl/core'
import { ActionFunctionArgs } from 'react-router'

import * as sceneSettingsOps from '../../lib/domain/scene/scene-settings.operations.server'
import { SceneSettingsParser } from '../../lib/domain/scene/scene-settings.parser.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensurePost } from '../../lib/http/requests.server'
import type { SceneSettingsAction } from '../../types/api'

/**
 * Handles scene settings API requests.
 * @param request - The HTTP request
 * @returns API response
 */
export async function action({ request }: ActionFunctionArgs) {
	// Ensure POST method
	const methodCheck = ensurePost(request)
	if (methodCheck) return methodCheck

	// Get authenticated user
	const authResult = await getAuthUser(request)
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

			case 'publish-scene':
				return await sceneSettingsOps.publishScene(
					{
						...requestData,
						action
					},
					user.id
				)

			default:
				return ApiResponse.badRequest(`Unknown action: ${action}`)
		}
	} catch (error) {
		console.error('Scene settings operation failed:', error)
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Operation failed'
		)
	}
}
