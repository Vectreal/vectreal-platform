import { randomUUID } from 'crypto'

import { UUID_REGEX } from '../../constants/utility-constants'
import type { SceneSettingsRequest } from '../../types/api'
import { sceneSettingsService } from '../services/scene-settings-service.server'
import { userService } from '../services/user-service.server'

import { ApiResponseBuilder } from './api-responses.server'

type ValidatedSaveRequest = Required<
	Pick<SceneSettingsRequest, 'settings' | 'gltfJson'>
> &
	Omit<SceneSettingsRequest, 'settings' | 'gltfJson'>

/**
 * Validates required fields for save operations and narrows types
 */
function validateSaveRequest(
	request: SceneSettingsRequest
): Response | ValidatedSaveRequest {
	if (!request.settings || !request.gltfJson) {
		return ApiResponseBuilder.badRequest('Settings and GLTF data are required')
	}
	return request as ValidatedSaveRequest
}

/**
 * Gets the project ID for an existing scene
 */
async function getSceneProjectId(sceneId: string): Promise<string> {
	const projectId = await sceneSettingsService.getProjectIdFromScene(sceneId)
	if (!projectId) {
		throw new Error(`Scene not found with ID: ${sceneId}`)
	}
	return projectId
}

/**
 * Creates a new scene in the user's default project
 */
async function createNewScene(
	userId: string
): Promise<{ sceneId: string; projectId: string }> {
	const newSceneId = randomUUID()
	const project = await userService.getOrCreateDefaultProject(userId)
	return { sceneId: newSceneId, projectId: project.id }
}

/**
 * Resolves scene and project IDs, creating a new scene if needed
 */
async function resolveSceneAndProject(
	sceneId: string | undefined,
	userId: string
): Promise<{ sceneId: string; projectId: string }> {
	// Validate UUID format if provided
	if (sceneId?.trim()) {
		if (!UUID_REGEX.test(sceneId)) {
			throw new Error('Scene ID must be a valid UUID format')
		}
		const projectId = await getSceneProjectId(sceneId)
		return { sceneId, projectId }
	}

	// Create new scene if no ID provided
	return await createNewScene(userId)
}

export async function saveSceneSettings(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	try {
		const validationResult = validateSaveRequest(request)
		if (validationResult instanceof Response) return validationResult

		// Ensure user exists in local database
		const userExists = await userService.userExists(userId)
		if (!userExists) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		const { sceneId: finalSceneId, projectId } = await resolveSceneAndProject(
			request.sceneId,
			userId
		)

		const saveResult = await sceneSettingsService.saveSceneSettings({
			sceneId: finalSceneId,
			projectId,
			userId,
			settings: validationResult.settings,
			gltfJson: validationResult.gltfJson,
			optimizationReport: request.optimizationReport
		})

		const result = { ...saveResult, sceneId: finalSceneId }
		return ApiResponseBuilder.success(result)
	} catch (error) {
		console.error('Failed to save scene settings:', error)
		return ApiResponseBuilder.serverError(
			error instanceof Error ? error.message : 'Failed to save scene settings'
		)
	}
}

export async function getSceneSettings(
	request: SceneSettingsRequest
): Promise<Response> {
	try {
		const { sceneId } = request

		if (!sceneId?.trim()) {
			return ApiResponseBuilder.badRequest('Scene ID is required')
		}

		if (!UUID_REGEX.test(sceneId)) {
			return ApiResponseBuilder.badRequest(
				'Scene ID must be a valid UUID format'
			)
		}

		const projectId = await sceneSettingsService.getProjectIdFromScene(sceneId)
		if (!projectId) {
			return ApiResponseBuilder.notFound(`Scene not found with ID: ${sceneId}`)
		}

		const result = await sceneSettingsService.getLatestSceneSettings(sceneId)
		const serialized: Record<
			string,
			{
				data: number[]
				mimeType: string
				fileName: string
			}
		> = {}
		result?.assetData?.forEach((value, key) => {
			serialized[key] = {
				data: Array.from(value.data), // Convert Uint8Array to number array
				mimeType: value.mimeType,
				fileName: value.fileName
			}
		})

		return ApiResponseBuilder.success({ ...result, assetData: serialized })
	} catch (error) {
		console.error('Failed to get scene settings:', error)
		return ApiResponseBuilder.serverError(
			error instanceof Error ? error.message : 'Failed to get scene settings'
		)
	}
}
