import { randomUUID } from 'crypto'

import { ApiResponse } from '@shared/utils'

import type {
	SceneSettingsData,
	SceneSettingsRequest
} from '../../../types/api'

import {
	getOrCreateDefaultProject,
	userExists
} from '../user/user-repository.server'

import { sceneSettingsService } from './scene-settings-service.server'

type SaveSceneSettingsRequest = SceneSettingsRequest & {
	settings: SceneSettingsData
}

type GetSceneSettingsRequest = SceneSettingsRequest & {
	sceneId: string
}

type PublishSceneRequest = SceneSettingsRequest & {
	sceneId: string
	publishedGlb: {
		data: number[]
		fileName?: string
		mimeType?: string
	}
	currentSceneBytes?: number
}

function assertParsed<T>(value: T, message: string): asserts value is T {
	if (!value) {
		throw new Error(message)
	}
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
	const project = await getOrCreateDefaultProject(userId)
	return { sceneId: newSceneId, projectId: project.id }
}

/**
 * Resolves scene and project IDs, creating a new scene if needed
 */
async function resolveSceneAndProject(
	sceneId: string | undefined,
	userId: string
): Promise<{ sceneId: string; projectId: string }> {
	if (sceneId?.trim()) {
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
		console.info('[scene-settings] save operation started', {
			requestId: request.requestId,
			userId,
			sceneId: request.sceneId || null
		})

		const validationResult = request as SaveSceneSettingsRequest
		assertParsed(
			validationResult.settings,
			'Scene settings request must be validated before calling operations'
		)

		// Ensure user exists in local database
		const hasUser = await userExists(userId)
		if (!hasUser) {
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
			optimizationReport: request.optimizationReport,
			optimizationSettings: request.optimizationSettings,
			initialSceneBytes: request.initialSceneBytes,
			currentSceneBytes: request.currentSceneBytes
		})

		console.info('[scene-settings] save operation completed', {
			requestId: request.requestId,
			userId,
			sceneId: finalSceneId,
			projectId,
			unchanged: Boolean((saveResult as { unchanged?: boolean }).unchanged)
		})

		const stats = await sceneSettingsService.getSceneStats(finalSceneId)
		const result = { ...saveResult, sceneId: finalSceneId, stats }
		return ApiResponse.success(result)
	} catch (error) {
		console.error('Failed to save scene settings:', {
			requestId: request.requestId,
			userId,
			sceneId: request.sceneId || null,
			error
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to save scene settings'
		)
	}
}

export async function getSceneSettings(
	request: SceneSettingsRequest
): Promise<Response> {
	try {
		const { sceneId } = request as GetSceneSettingsRequest
		assertParsed(
			sceneId,
			'Scene settings request must be validated before calling operations'
		)

		const projectId = await sceneSettingsService.getProjectIdFromScene(sceneId)
		if (!projectId) {
			return ApiResponse.notFound(`Scene not found with ID: ${sceneId}`)
		}

		const result =
			await sceneSettingsService.getSceneSettingsWithAssets(sceneId)
		const serialized: Record<
			string,
			{
				data: number[]
				mimeType: string
				fileName: string
			}
		> = {}
		result?.assetDataMap?.forEach((value, key) => {
			serialized[key] = {
				data: Array.from(value.data), // Convert Uint8Array to number array
				mimeType: value.mimeType,
				fileName: value.fileName
			}
		})

		return ApiResponse.success({ ...result, assetData: serialized })
	} catch (error) {
		console.error('Failed to get scene settings:', error)
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to get scene settings'
		)
	}
}

export async function publishScene(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	try {
		const { sceneId, publishedGlb, currentSceneBytes } =
			request as PublishSceneRequest
		assertParsed(
			sceneId,
			'Scene settings request must be validated before calling operations'
		)
		assertParsed(
			publishedGlb,
			'Scene publish request must be validated before calling operations'
		)

		// Ensure user exists in local database
		const hasUser = await userExists(userId)
		if (!hasUser) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		const projectId = await getSceneProjectId(sceneId)

		const result = await sceneSettingsService.publishScene({
			sceneId,
			projectId,
			userId,
			publishedGlb,
			currentSceneBytes
		})
		const stats = await sceneSettingsService.getSceneStats(sceneId)

		return ApiResponse.success({ ...result, sceneId, stats })
	} catch (error) {
		console.error('Failed to publish scene:', error)
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to publish scene'
		)
	}
}
