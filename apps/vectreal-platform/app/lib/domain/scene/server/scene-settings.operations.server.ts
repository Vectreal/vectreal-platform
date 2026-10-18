import { ApiResponse } from '@shared/utils'
import { SerializedSceneAssetDataMap, SceneSettings } from '@vctrl/core'

import { getScene, getSceneFolder } from './scene-folder-repository.server'
import {
	assertParsed,
	resolveSceneAndProject
} from './scene-operation-context.server'
import {
	SceneSaveRefusedError,
	sceneSettingsService
} from './scene-settings-service.server'
import { reportServerError } from '../../../observability/report-server-error.server'
import {
	reclaimStaleProjectAssets,
	reclaimUploadBatch
} from '../../asset/asset-reclaim.server'
import { getProject } from '../../project/project-repository.server'
import { userExists } from '../../user/user-repository.server'

import type { SceneSettingsRequest } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'

type SaveSceneSettingsRequest = SceneSettingsRequest & {
	meta: SceneMetaState
	settings: SceneSettings
	sceneAssetIds: string[]
}

export type GetSceneSettingsRequest = SceneSettingsRequest & {
	sceneId: string
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

	/*
	  Nested folders used to be rejected here with "Only root-level folders are
	  allowed", while the publisher's location picker rendered the whole tree
	  with depth indentation - so picking a subfolder produced a 500. Folders are
	  hierarchical by design, `getSceneFolderTree` reports depth, and the
	  dashboard now moves scenes into subfolders freely, so the restriction was
	  the odd one out rather than the rule.
	*/
}

export async function saveSceneSettings(
	request: SceneSettingsRequest,
	userId: string
): Promise<Response> {
	let reclaimProjectId: string | null = null

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
		// Held outside the try so a rejected save can still reclaim what its
		// uploads already wrote.
		reclaimProjectId = projectId

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
				sourceAssetId: request.sourceAssetId,
				optimizationReport: request.optimizationReport,
				optimizationSettings: request.optimizationSettings,
				initialSceneBytes: request.initialSceneBytes
			}
		)

		console.info('[scene-settings] save operation completed', {
			requestId: request.requestId,
			userId,
			sceneId: finalSceneId,
			projectId,
			unchanged: Boolean((saveResult as { unchanged?: boolean }).unchanged)
		})

		// Anything this batch uploaded that the commit did not link is
		// unreachable from here on: it is in no link table, so no later save or
		// delete would ever list it as a candidate.
		await reclaimUploadBatch({
			requestId: request.requestId,
			projectId,
			keepAssetIds: validationResult.sceneAssetIds
		})
		// Backstop for batches that never reached any commit, so no request ever
		// carries their id. A successful save is the only in-band trigger there is.
		await reclaimStaleProjectAssets({ projectId })

		const [stats, savedScene] = await Promise.all([
			sceneSettingsService.getSceneStats(finalSceneId),
			getScene(finalSceneId, userId)
		])
		if (!savedScene) {
			throw new Error(`Scene not found with ID: ${finalSceneId}`)
		}

		const [project, folder] = await Promise.all([
			getProject(savedScene.projectId, userId),
			savedScene.folderId
				? getSceneFolder(savedScene.folderId, userId)
				: Promise.resolve(null)
		])

		const result = {
			...saveResult,
			sceneId: finalSceneId,
			stats,
			currentLocation: {
				projectId: savedScene.projectId,
				projectName: project?.name ?? null,
				folderId: savedScene.folderId,
				folderName: folder?.name ?? null
			}
		}
		return ApiResponse.success(result)
	} catch (error) {
		const refused = error instanceof SceneSaveRefusedError
		if (!refused) {
			reportServerError(error, {
				properties: {
					requestId: request.requestId,
					userId,
					sceneId: request.sceneId || null
				}
			})
		}
		// The uploads are already committed to storage by the time the save is
		// rejected. Nothing linked them, so this is the last chance to find them.
		if (reclaimProjectId) {
			await reclaimUploadBatch({
				requestId: request.requestId,
				projectId: reclaimProjectId
			})
		}
		if (refused) {
			return ApiResponse.badRequest(error.message)
		}
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to save scene settings'
		)
	}
}

export async function getSceneSettings(
	request: SceneSettingsRequest,
	options?: { forPublicView?: boolean }
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

		const finalResult =
			options?.forPublicView && result.settings?.hotspots
				? {
						...result,
						settings: {
							...result.settings,
							hotspots: result.settings.hotspots.filter((h) => !h.internalOnly)
						}
					}
				: result

		return ApiResponse.success({ ...finalResult, meta, assetData: serialized })
	} catch (error) {
		reportServerError(error, {
			properties: { sceneId: request.sceneId || null }
		})
		return ApiResponse.serverError(
			error instanceof Error ? error.message : 'Failed to get scene settings'
		)
	}
}
