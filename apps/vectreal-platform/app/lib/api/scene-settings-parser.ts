import type { SceneSettingsRequest } from '../../types/api'

import { PlatformApiService } from '../services/platform-api-service.server'

import { ApiResponseBuilder } from './api-responses'

/**
 * Request parser for scene settings API operations.
 * Handles validation and normalization of incoming requests.
 */
export class SceneSettingsParser {
	/**
	 * Parses and validates scene settings request data.
	 * @param request - The HTTP request to parse
	 * @returns Parsed request data or error response
	 */
	static async parseSceneSettingsRequest(
		request: Request
	): Promise<SceneSettingsRequest | Response> {
		try {
			const requestData = await PlatformApiService.parseActionRequest(request)

			// Extract required fields
			const action = requestData.action as string
			const sceneId = requestData.sceneId as string

			// Validate required fields
			if (!action) {
				return ApiResponseBuilder.badRequest('Action is required')
			}

			// Parse settings data
			const settings = this.parseSettingsData(requestData)
			if (settings instanceof Response) {
				return settings
			}

			// Parse asset IDs
			const assetIds = this.parseAssetIds(requestData)
			if (assetIds instanceof Response) {
				return assetIds
			}

			return {
				action,
				sceneId,
				settings: settings || {},
				assetIds: assetIds || []
			}
		} catch (error) {
			console.error('Failed to parse scene settings request:', error)
			return ApiResponseBuilder.badRequest('Invalid request format')
		}
	}

	/**
	 * Gets authenticated user for scene settings operations.
	 * @param request - The HTTP request
	 * @returns User object or error response
	 */
	static async getSceneSettingsAuth(request: Request) {
		const authResult = await PlatformApiService.getAuthUser(request)

		if (authResult instanceof Response) {
			return authResult
		}

		return authResult.user
	}

	/**
	 * Parses settings data from request.
	 */
	private static parseSettingsData(
		requestData: Record<string, unknown>
	): Record<string, unknown> | Response {
		let settings: Record<string, unknown> = {}

		if (requestData.settingsData) {
			if (typeof requestData.settingsData === 'string') {
				try {
					settings = JSON.parse(requestData.settingsData)
				} catch (error) {
					console.error('Failed to parse settingsData:', error)
					return ApiResponseBuilder.badRequest('Invalid settings data format')
				}
			} else {
				settings = requestData.settingsData as Record<string, unknown>
			}
		} else if (requestData.settings) {
			settings = requestData.settings as Record<string, unknown>
		}

		return settings
	}

	/**
	 * Parses asset IDs from request.
	 */
	private static parseAssetIds(
		requestData: Record<string, unknown>
	): string[] | Response {
		console.log(
			'Parsing assetIds from requestData:',
			requestData,
			requestData.assetIds
		)
		let assetIds: string[] = []

		if (requestData.assetIds) {
			if (typeof requestData.assetIds === 'string') {
				try {
					assetIds = JSON.parse(requestData.assetIds)
				} catch (error) {
					console.error('Failed to parse assetIds:', error)
					return ApiResponseBuilder.badRequest('Invalid asset IDs format')
				}
			} else if (Array.isArray(requestData.assetIds)) {
				assetIds = requestData.assetIds as string[]
			}
		}

		return assetIds
	}
}

// Legacy exports for backward compatibility
export const parseSceneSettingsRequest =
	SceneSettingsParser.parseSceneSettingsRequest
export const getSceneSettingsAuth = SceneSettingsParser.getSceneSettingsAuth
