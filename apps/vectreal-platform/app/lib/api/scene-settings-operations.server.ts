import { randomUUID } from 'crypto'

import { OptimizationReport } from '@vctrl/core'

import { UUID_REGEX } from '../../constants/utility-constants'
import type {
	GetSceneSettingsParams,
	SaveSceneSettingsParams,
	SceneSettingsRequest
} from '../../types/api'
import { sceneSettingsService } from '../services/scene-settings-service.server'
import { userService } from '../services/user-service.server'

import { ApiResponseBuilder } from './api-responses.server'

/**
 * Validates and normalizes scene ID.
 * @param sceneId - Scene ID to validate
 * @returns Validated scene ID or null if no valid ID provided
 * @throws Error if scene ID format is invalid
 */
function validateSceneId(sceneId: string | undefined): string | null {
	// If sceneId is empty, null, undefined, or just whitespace, return null
	if (!sceneId || sceneId.trim() === '') {
		return null
	}

	if (!UUID_REGEX.test(sceneId)) {
		throw new Error('Scene ID must be a valid UUID format')
	}

	return sceneId
}

/**
 * Handles save scene settings operation.
 * @param params - Save scene settings parameters
 * @returns Saved scene settings with scene ID
 * @throws Error if user doesn't exist in local database
 */
export async function saveSceneSettings(
	params: Omit<SaveSceneSettingsParams, 'projectId'> & {
		optimizationReport?: unknown
	}
) {
	const { sceneId, settings, gltfJson, userId, optimizationReport } = params
	// First, ensure user exists in local database (fallback for existing auth users)
	const userExists = await userService.userExists(userId)
	if (!userExists) {
		// User doesn't exist in local DB, we can't create a scene folder without a user
		throw new Error(
			'User not found in local database. Please sign out and sign back in.'
		)
	}

	// Validate the scene ID - returns null if no valid ID provided
	const validSceneId = validateSceneId(sceneId)
	let projectId: string
	let finalSceneId: string

	if (validSceneId) {
		// Existing scene - get the project ID
		const existingProjectId =
			await sceneSettingsService.getProjectIdFromScene(validSceneId)

		if (!existingProjectId) {
			throw new Error(`Scene not found with ID: ${validSceneId}`)
		}

		projectId = existingProjectId
		finalSceneId = validSceneId
	} else {
		// New scene - generate UUID and create default project
		finalSceneId = randomUUID()
		const project = await userService.getOrCreateDefaultProject(userId)
		projectId = project.id
	}

	// Use saveSceneSettings which handles both create and update cases
	const result = await sceneSettingsService.saveSceneSettings({
		sceneId: finalSceneId,
		projectId,
		userId,
		settings,
		gltfJson,
		optimizationReport
	})

	// Return the result with the actual scene ID used - ensure sceneId is set correctly
	return {
		...result,
		sceneId: finalSceneId // Explicitly override any sceneId from service result
	}
}

/**
 * Handles get scene settings operation.
 * @param params - Get scene settings parameters
 * @returns Scene settings or null if not found
 * @throws Error if scene doesn't exist
 */
export async function getSceneSettings(params: GetSceneSettingsParams) {
	const { sceneId } = params

	// Verify scene exists (userId validation happens in the service)
	const projectId = await sceneSettingsService.getProjectIdFromScene(sceneId)

	if (!projectId) {
		throw new Error(`Scene not found with ID: ${sceneId}`)
	}

	// Get the scene settings
	return sceneSettingsService.getLatestSceneSettings(sceneId)
}

/**
 * Validates save scene settings request.
 * @param request - The request to validate
 * @param userId - The user ID
 * @returns Validation error response or null if valid
 */
function validateSaveRequest(
	request: SceneSettingsRequest,
	userId: string
): Response | null {
	if (!userId?.trim()) {
		return ApiResponseBuilder.badRequest('User ID is required')
	}

	if (typeof request.settings !== 'object' || request.settings === null) {
		return ApiResponseBuilder.badRequest('Settings must be a valid object')
	}

	return null
}

/**
 * Validates get scene settings request.
 * @param request - The request to validate
 * @param userId - The user ID
 * @returns Validation error response or null if valid
 */
function validateGetRequest(
	request: SceneSettingsRequest,
	userId: string
): Response | null {
	if (!userId?.trim()) {
		return ApiResponseBuilder.badRequest('User ID is required')
	}

	if (!request.sceneId?.trim()) {
		return ApiResponseBuilder.badRequest('Scene ID is required')
	}

	return null
}

/**
 * Business logic layer for saving scene settings.
 * Handles validation, coordination between services, and business rules.
 * @param request - Scene settings save request
 * @param userId - ID of the user making the request
 * @returns API response with saved settings or error
 */
export async function saveSceneSettingsWithValidation(
	request: SceneSettingsRequest & { optimizationReport?: unknown },
	userId: string
): Promise<Response> {
	try {
		// Validate request parameters
		const validationResult = validateSaveRequest(request, userId)
		if (validationResult instanceof Response) {
			return validationResult
		}

		// Ensure required fields exist after validation
		// Note: sceneId can be empty/null for new scenes
		if (!request.settings || !request.gltfJson) {
			return ApiResponseBuilder.badRequest(
				'Settings and GLTF data are required'
			)
		}

		// Business logic: Save scene settings
		const result = await saveSceneSettings({
			sceneId: request.sceneId,
			settings: request.settings,
			gltfJson: request.gltfJson,
			userId,
			optimizationReport: request.optimizationReport as
				| OptimizationReport
				| undefined
		})

		return ApiResponseBuilder.success(result)
	} catch (error) {
		console.error('Failed to save scene settings:', error)
		return ApiResponseBuilder.serverError(
			error instanceof Error ? error.message : 'Failed to save scene settings'
		)
	}
}

/**
 * Serializes asset data Map for JSON transfer
 */
function serializeAssetData(
	assetData:
		| Map<string, { data: Uint8Array; mimeType: string; fileName: string }>
		| undefined
):
	| Record<string, { data: number[]; mimeType: string; fileName: string }>
	| undefined {
	if (!assetData) return undefined

	const serialized: Record<
		string,
		{ data: number[]; mimeType: string; fileName: string }
	> = {}

	assetData.forEach((value, key) => {
		serialized[key] = {
			data: Array.from(value.data), // Convert Uint8Array to number array
			mimeType: value.mimeType,
			fileName: value.fileName
		}
	})

	return serialized
}

/**
 * Business logic layer for retrieving scene settings.
 * Handles validation, coordination between services, and business rules.
 * @param request - Scene settings retrieval request
 * @param userId - ID of the user making the request
 * @returns API response with scene settings or error
 */
export async function getSceneSettingsWithValidation(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	try {
		// Validate request parameters
		const validationResult = validateGetRequest(request, userId)
		if (validationResult instanceof Response) {
			return validationResult
		}

		if (!request.sceneId) {
			return ApiResponseBuilder.badRequest('Scene ID is required')
		}

		// Business logic: Get scene settings
		const result = await getSceneSettings({
			sceneId: request.sceneId,
			userId
		})

		// Serialize asset data Map for JSON transfer
		if (result && result.assetData) {
			const serializedResult = {
				...result,
				assetData: serializeAssetData(result.assetData)
			}
			return ApiResponseBuilder.success(serializedResult)
		}

		return ApiResponseBuilder.success(result)
	} catch (error) {
		console.error('Failed to get scene settings:', error)

		// Handle specific error cases
		if (error instanceof Error && error.message.includes('not found')) {
			return ApiResponseBuilder.notFound(error.message)
		}

		return ApiResponseBuilder.serverError(
			error instanceof Error
				? error.message
				: 'Failed to retrieve scene settings'
		)
	}
}
