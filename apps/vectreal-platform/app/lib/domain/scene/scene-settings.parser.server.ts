import { JSONDocument } from '@gltf-transform/core'
import { ApiResponse } from '@shared/utils'
import { OptimizationReport } from '@vctrl/core'

import { UUID_REGEX } from '../../../constants/utility-constants'
import type { SceneSettingsRequest } from '../../../types/api'

import { parseActionRequest } from '../../http/requests.server'

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
			const requestData = await parseActionRequest(request)

			// Extract required fields
			const action = requestData.action as string
			const rawSceneId = requestData.sceneId as string
			const sceneId =
				typeof rawSceneId === 'string' ? rawSceneId.trim() : rawSceneId

			// Validate required fields
			if (!action) {
				return ApiResponse.badRequest('Action is required')
			}

			const sceneIdValidation = this.validateSceneId(action, sceneId)
			if (sceneIdValidation instanceof Response) {
				return sceneIdValidation
			}

			// For get-scene-settings, we don't need settings or gltfJson
			if (action === 'get-scene-settings') {
				return {
					action,
					sceneId,
					settings: undefined,
					gltfJson: undefined
				}
			}

			if (action === 'publish-scene') {
				const publishedGlb = this.parsePublishedGlb(requestData)
				if (publishedGlb instanceof Response) {
					return publishedGlb
				}

				return {
					action,
					sceneId,
					settings: undefined,
					gltfJson: undefined,
					publishedGlb
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

			const optimizationReport = this.parseOptimizationReport(requestData)
			if (optimizationReport instanceof Response) {
				return optimizationReport
			}

			if (!sceneId && !gltfJsonData) {
				return ApiResponse.badRequest('GLTF data is required for new scenes')
			}

			return {
				action,
				sceneId,
				settings,
				gltfJson: gltfJsonData || undefined,
				optimizationReport: optimizationReport || undefined
			}
		} catch (error) {
			console.error('Failed to parse scene settings request:', error)
			return ApiResponse.badRequest('Invalid request format')
		}
	}

	private static validateSceneId(
		action: string,
		sceneId?: string
	): Response | null {
		const requiresSceneId =
			action === 'get-scene-settings' || action === 'publish-scene'

		if (requiresSceneId && !sceneId) {
			return ApiResponse.badRequest('Scene ID is required')
		}

		if (sceneId && !UUID_REGEX.test(sceneId)) {
			return ApiResponse.badRequest('Scene ID must be a valid UUID format')
		}

		return null
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
					return ApiResponse.badRequest('Invalid settings data format')
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
					return ApiResponse.badRequest('Invalid settings data format')
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
			return ApiResponse.badRequest('Settings must be a valid object')
		}

		return settings
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
						return ApiResponse.badRequest('Invalid gltfJson format')
					}
				} catch (error) {
					console.error('Failed to parse gltfJson:', error)
					return ApiResponse.badRequest('Invalid gltfJson format')
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
	): OptimizationReport | undefined | Response {
		if (!requestData.optimizationReport) {
			return undefined
		}

		if (typeof requestData.optimizationReport === 'string') {
			try {
				const parsed = JSON.parse(requestData.optimizationReport)
				if (typeof parsed !== 'object' || parsed === null) {
					return ApiResponse.badRequest('Invalid optimization report format')
				}
				return parsed
			} catch (error) {
				console.error('Failed to parse optimizationReport:', error)
				return ApiResponse.badRequest('Invalid optimization report format')
			}
		}

		if (typeof requestData.optimizationReport === 'object') {
			return requestData.optimizationReport as OptimizationReport
		}

		return undefined
	}

	private static parsePublishedGlb(
		requestData: Record<string, unknown>
	): { data: number[]; fileName?: string; mimeType?: string } | Response {
		if (!requestData.publishedGlb) {
			return ApiResponse.badRequest('publishedGlb is required')
		}

		let payload: unknown = requestData.publishedGlb

		if (typeof requestData.publishedGlb === 'string') {
			try {
				payload = JSON.parse(requestData.publishedGlb)
			} catch (error) {
				console.error('Failed to parse publishedGlb:', error)
				return ApiResponse.badRequest('Invalid publishedGlb format')
			}
		}

		if (!payload || typeof payload !== 'object') {
			return ApiResponse.badRequest('Invalid publishedGlb format')
		}

		const record = payload as {
			data?: number[]
			fileName?: string
			mimeType?: string
		}

		if (!Array.isArray(record.data)) {
			return ApiResponse.badRequest('publishedGlb data is required')
		}

		if (!record.data.every((value) => typeof value === 'number')) {
			return ApiResponse.badRequest('publishedGlb data is invalid')
		}

		return {
			data: record.data,
			fileName: record.fileName,
			mimeType: record.mimeType
		}
	}
}
