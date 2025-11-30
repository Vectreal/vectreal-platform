import { LoaderFunctionArgs } from 'react-router'

import { ApiResponseBuilder } from '../../lib/api/api-responses.server'
import { sceneSettingsService } from '../../lib/services/scene-settings-service.server'
import { PlatformApiService } from '../../lib/services/platform-api-service.server'

/**
 * Handles scene stats API requests (GET only).
 * Retrieves scene statistics based on query parameters.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	// Get authenticated user
	const authResult = await PlatformApiService.getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const url = new URL(request.url)
	const sceneId = url.searchParams.get('sceneId')

	if (!sceneId) {
		return ApiResponseBuilder.badRequest('sceneId is required')
	}

	try {
		// Parse optional query parameters
		const version = url.searchParams.get('version')
		const label = url.searchParams.get('label')
		const limit = url.searchParams.get('limit')

		const options: { version?: number; label?: string; limit?: number } = {}

		if (version) {
			const parsedVersion = parseInt(version, 10)
			if (!isNaN(parsedVersion)) {
				options.version = parsedVersion
			}
		}

		if (label) {
			options.label = label
		}

		if (limit) {
			const parsedLimit = parseInt(limit, 10)
			if (!isNaN(parsedLimit)) {
				options.limit = parsedLimit
			}
		}

		// Fetch scene stats from database
		const stats = await sceneSettingsService.getSceneStats(sceneId, options)

		return ApiResponseBuilder.success(stats)
	} catch (error) {
		console.error('Failed to fetch scene stats:', error)
		return ApiResponseBuilder.serverError(
			error instanceof Error ? error.message : 'Failed to fetch scene stats'
		)
	}
}
