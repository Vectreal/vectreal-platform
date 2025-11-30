import { JSONDocument } from '@gltf-transform/core'

import type { SceneSettingsRequest } from '../../types/api'

import { PlatformApiService } from '../services/platform-api-service.server'

import { ApiResponseBuilder } from './api-responses.server'

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

			// For get-scene-settings, we don't need settings or gltfJson
			if (action === 'get-scene-settings') {
				return {
					action,
					sceneId,
					settings: undefined,
					assetIds: [],
					gltfJson: undefined
				}
			}

			// Parse settings data (required for save operations)
			const settings = this.parseSettingsData(requestData)
			if (settings instanceof Response) {
				return settings
			}

			const gltfJsonData = this.parseGltfJson(requestData)
			if (gltfJsonData instanceof Response) {
				return gltfJsonData
			}

			const assetIds = this.parseAssetIds(requestData)
			if (assetIds instanceof Response) {
				return assetIds
			}

			const optimizationReport = this.parseOptimizationReport(requestData)
			if (optimizationReport instanceof Response) {
				return optimizationReport
			}

			return {
				action,
				sceneId,
				settings,
				assetIds: assetIds || [],
				gltfJson: gltfJsonData || undefined,
				optimizationReport: optimizationReport || undefined
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
		let settings: Record<string, unknown> | undefined

		// Try 'settings' field first (current implementation)
		if (requestData.settings) {
			if (typeof requestData.settings === 'string') {
				try {
					settings = JSON.parse(requestData.settings)
				} catch (error) {
					console.error('Failed to parse settings:', error)
					return ApiResponseBuilder.badRequest('Invalid settings data format')
				}
			} else if (
				typeof requestData.settings === 'object' &&
				requestData.settings !== null
			) {
				settings = requestData.settings as Record<string, unknown>
			}
		}

		// Fallback to 'settingsData' field
		if (!settings && requestData.settingsData) {
			if (typeof requestData.settingsData === 'string') {
				try {
					settings = JSON.parse(requestData.settingsData)
				} catch (error) {
					console.error('Failed to parse settingsData:', error)
					return ApiResponseBuilder.badRequest('Invalid settings data format')
				}
			} else if (
				typeof requestData.settingsData === 'object' &&
				requestData.settingsData !== null
			) {
				settings = requestData.settingsData as Record<string, unknown>
			}
		}

		// Validate that we have a valid settings object
		if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
			console.error('Invalid settings format:', settings)
			return ApiResponseBuilder.badRequest('Settings must be a valid object')
		}

		return settings
	}

	private static parseAssetIds(
		requestData: Record<string, unknown>
	): string[] | Response {
		let assetIds: string[] = []

		if (requestData.assetIds) {
			if (typeof requestData.assetIds === 'string') {
				try {
					const parsed = JSON.parse(requestData.assetIds)
					if (
						Array.isArray(parsed) &&
						parsed.every((id) => typeof id === 'string')
					) {
						assetIds = parsed
					} else {
						return ApiResponseBuilder.badRequest('Invalid asset IDs format')
					}
				} catch (error) {
					console.error('Failed to parse assetIds:', error)
					return ApiResponseBuilder.badRequest('Invalid asset IDs format')
				}
			} else if (Array.isArray(requestData.assetIds)) {
				if (requestData.assetIds.every((id) => typeof id === 'string')) {
					assetIds = requestData.assetIds as string[]
				} else {
					return ApiResponseBuilder.badRequest('Invalid asset IDs format')
				}
			} else {
				return ApiResponseBuilder.badRequest('Invalid asset IDs format')
			}
		}

		return assetIds
	}

	/**
	 * Parses GLTF JSON from request.
	 */
	private static parseGltfJson(
		requestData: Record<string, unknown>
	): JSONDocument | undefined | Response {
		let gltf: JSONDocument | null = null

		if (requestData.gltfJson) {
			if (typeof requestData.gltfJson === 'string') {
				try {
					gltf = JSON.parse(requestData.gltfJson)

					if (typeof gltf !== 'object' || gltf === null) {
						return ApiResponseBuilder.badRequest('Invalid gltfJson format')
					}
				} catch (error) {
					console.error('Failed to parse gltfJson:', error)
					return ApiResponseBuilder.badRequest('Invalid gltfJson format')
				}
			}
		}

		// Return undefined if no gltfJson provided (it's optional for some operations)
		return gltf || undefined
	}

	/**
	 * Parses optimization report from request.
	 */
	private static parseOptimizationReport(
		requestData: Record<string, unknown>
	): Record<string, unknown> | undefined | Response {
		if (!requestData.optimizationReport) {
			return undefined
		}

		if (typeof requestData.optimizationReport === 'string') {
			try {
				const parsed = JSON.parse(requestData.optimizationReport)
				if (typeof parsed !== 'object' || parsed === null) {
					return ApiResponseBuilder.badRequest(
						'Invalid optimization report format'
					)
				}
				return parsed
			} catch (error) {
				console.error('Failed to parse optimizationReport:', error)
				return ApiResponseBuilder.badRequest(
					'Invalid optimization report format'
				)
			}
		}

		if (typeof requestData.optimizationReport === 'object') {
			return requestData.optimizationReport as Record<string, unknown>
		}

		return undefined
	}
}
