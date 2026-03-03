import { randomUUID } from 'crypto'

import { ApiResponse } from '@shared/utils'
import { SerializedSceneAssetDataMap, SceneSettings } from '@vctrl/core'

import { getSceneFolder } from './scene-folder-repository.server'
import { sceneSettingsService } from './scene-settings-service.server'
import { uploadSceneAssets } from '../asset/asset-storage.server'
import { getProject } from '../project/project-repository.server'
import {
	getOrCreateDefaultProject,
	userExists
} from '../user/user-repository.server'

import type { SceneSettingsRequest } from '../../../types/api'
import type { SceneMetaState } from '../../../types/publisher-config'

type SaveSceneSettingsRequest = SceneSettingsRequest & {
	meta: SceneMetaState
	settings: SceneSettings
	sceneAssetIds: string[]
}

type GetSceneSettingsRequest = SceneSettingsRequest & {
	sceneId: string
}

type PublishSceneRequest = SceneSettingsRequest & {
	sceneId: string
	publishedAssetId: string
	currentSceneBytes?: number
}

type UploadPreparedScene = {
	sceneId: string
	projectId: string
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
	userId: string,
	targetProjectId?: string,
	projectId?: string
): Promise<{ sceneId: string; projectId: string }> {
	if (sceneId?.trim()) {
		const existingProjectId = await sceneSettingsService.getProjectIdFromScene(
			sceneId
		)

		if (existingProjectId) {
			const resolvedProjectId = targetProjectId ?? existingProjectId
			return { sceneId, projectId: resolvedProjectId }
		}

		const fallbackProjectId = targetProjectId ?? projectId
		if (fallbackProjectId) {
			const project = await getProject(fallbackProjectId, userId)
			if (!project) {
				throw new Error('Target project not found or access denied')
			}

			return { sceneId, projectId: fallbackProjectId }
		}

		throw new Error(`Scene not found with ID: ${sceneId}`)
	}

	// Create new scene if no ID provided
	if (targetProjectId) {
		const project = await getProject(targetProjectId, userId)
		if (!project) {
			throw new Error('Target project not found or access denied')
		}

		return { sceneId: randomUUID(), projectId: targetProjectId }
	}

	return await createNewScene(userId)
}

async function validateSaveLocationTarget(
	request: SceneSettingsRequest,
	userId: string,
	resolvedProjectId: string
): Promise<void> {
	if (request.targetProjectId) {
		const project = await getProject(request.targetProjectId, userId)
		if (!project) {
			throw new Error('Target project not found or access denied')
		}
	}

	if (typeof request.targetFolderId === 'undefined') {
		return
	}

	if (request.targetFolderId === null) {
		return
	}

	const folder = await getSceneFolder(request.targetFolderId, userId)
	if (!folder) {
		throw new Error('Target folder not found or access denied')
	}

	if (folder.projectId !== resolvedProjectId) {
		throw new Error('Target folder must belong to the selected project')
	}

	if (folder.parentFolderId !== null) {
		throw new Error('Only root-level folders are allowed')
	}
}

export async function prepareSceneUpload(
	request: SceneSettingsRequest,
	userId: string
): Promise<UploadPreparedScene> {
	const hasUser = await userExists(userId)
	if (!hasUser) {
		throw new Error(
			'User not found in local database. Please sign out and sign back in.'
		)
	}

	return resolveSceneAndProject(
		request.sceneId,
		userId,
		request.targetProjectId,
		request.projectId
	)
}

export async function uploadSceneAsset(
	request: SceneSettingsRequest,
	userId: string,
	file: File,
	kind: 'buffer' | 'image'
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const bytes = new Uint8Array(await file.arrayBuffer())

		const [uploadResult] = await uploadSceneAssets(sceneId, userId, projectId, [
			{
				fileName: file.name,
				data: bytes,
				mimeType: file.type || 'application/octet-stream',
				type: kind
			}
		])

		return ApiResponse.success({
			sceneId,
			projectId,
			assetId: uploadResult.assetId,
			fileName: uploadResult.fileName,
			mimeType: uploadResult.mimeType
		})
	} catch (error) {
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to upload scene asset'
		)
	}
}

export async function uploadSceneGltf(
	request: SceneSettingsRequest,
	userId: string,
	file: File
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const bytes = new Uint8Array(await file.arrayBuffer())

		const [uploadResult] = await uploadSceneAssets(sceneId, userId, projectId, [
			{
				fileName: file.name || 'scene.gltf',
				data: bytes,
				mimeType: file.type || 'model/gltf+json',
				type: 'buffer'
			}
		])

		return ApiResponse.success({
			sceneId,
			projectId,
			assetId: uploadResult.assetId,
			fileName: uploadResult.fileName,
			mimeType: uploadResult.mimeType
		})
	} catch (error) {
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to upload scene glTF'
		)
	}
}

export async function uploadPublishedGlb(
	request: SceneSettingsRequest,
	userId: string,
	file: File
): Promise<Response> {
	try {
		const { sceneId, projectId } = await prepareSceneUpload(request, userId)
		const bytes = new Uint8Array(await file.arrayBuffer())

		const [uploadResult] = await uploadSceneAssets(sceneId, userId, projectId, [
			{
				fileName: file.name || 'scene.glb',
				data: bytes,
				mimeType: file.type || 'model/gltf-binary',
				type: 'buffer'
			}
		])

		return ApiResponse.success({
			sceneId,
			projectId,
			assetId: uploadResult.assetId,
			fileName: uploadResult.fileName,
			mimeType: uploadResult.mimeType
		})
	} catch (error) {
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to upload published GLB'
		)
	}
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
		assertParsed(
			validationResult.sceneAssetIds,
			'commit-scene-save requires sceneAssetIds'
		)

		const hasUser = await userExists(userId)
		if (!hasUser) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		const { sceneId: finalSceneId, projectId } = await resolveSceneAndProject(
			request.sceneId,
			userId,
			request.targetProjectId,
			request.projectId
		)

		await validateSaveLocationTarget(request, userId, projectId)

		const saveResult = await sceneSettingsService.saveSceneSettingsFromAssetIds(
			{
				sceneId: finalSceneId,
				projectId,
				targetProjectId: request.targetProjectId,
				targetFolderId: request.targetFolderId,
				userId,
				meta: validationResult.meta,
				settings: validationResult.settings,
				sceneAssetIds: validationResult.sceneAssetIds,
				optimizationReport: request.optimizationReport,
				optimizationSettings: request.optimizationSettings,
				initialSceneBytes: request.initialSceneBytes,
				currentSceneBytes: request.currentSceneBytes
			}
		)

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

		const [result, meta] = await Promise.all([
			sceneSettingsService.getSceneSettingsWithAssets(sceneId),
			sceneSettingsService.getSceneMetadata(sceneId)
		])
		const serialized: SerializedSceneAssetDataMap = {}
		result?.assetDataMap?.forEach((value, key) => {
			serialized[key] = {
				data: Buffer.from(value.data).toString('base64'),
				mimeType: value.mimeType,
				fileName: value.fileName,
				encoding: 'base64'
			}
		})

		if (!result) {
			return ApiResponse.success({
				meta,
				settings: null,
				assets: null,
				assetData: serialized,
				gltfJson: null
			})
		}

		return ApiResponse.success({ ...result, meta, assetData: serialized })
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
		const { sceneId, publishedAssetId, currentSceneBytes } =
			request as PublishSceneRequest
		assertParsed(
			sceneId,
			'Scene settings request must be validated before calling operations'
		)
		assertParsed(
			publishedAssetId,
			'commit-scene-publish requires publishedAssetId'
		)

		// Ensure user exists in local database
		const hasUser = await userExists(userId)
		if (!hasUser) {
			throw new Error(
				'User not found in local database. Please sign out and sign back in.'
			)
		}

		const projectId = await getSceneProjectId(sceneId)

		const result = await sceneSettingsService.publishSceneFromAssetId({
			sceneId,
			projectId,
			userId,
			publishedAssetId,
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
