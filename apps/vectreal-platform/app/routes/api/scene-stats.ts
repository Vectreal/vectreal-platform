import { ApiResponse } from '@shared/utils'
import { LoaderFunctionArgs } from 'react-router'

import { sceneSettingsService } from '../../lib/domain/scene/scene-settings-service.server'
import { getAuthUser } from '../../lib/http/auth.server'

/**
 * Handles scene stats API requests (GET only).
 * Retrieves scene statistics based on query parameters.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	// Get authenticated user
	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const url = new URL(request.url)
	const sceneId = url.searchParams.get('sceneId')

	if (!sceneId) {
		return ApiResponse.badRequest('sceneId is required')
	}

	try {
		const stats = await sceneSettingsService.getSceneStats(sceneId)

		return ApiResponse.success(stats)
	} catch (error) {
		console.error('Failed to fetch scene stats:', error)
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to fetch scene stats'
		)
	}
}
