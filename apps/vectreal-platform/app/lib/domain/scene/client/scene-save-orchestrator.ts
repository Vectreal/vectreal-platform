import { createFileFromDataUrl } from './scene-draft-serialization'
import {
	buildImageMimeLookup,
	buildSceneUploadFileDescriptor
} from './scene-upload-manifest'
import { createBillingLimitErrorFromResponse } from '../../billing/client/billing-limit-error'

import type { SceneMetaState } from '../../../../types/publisher-config'
import type { SceneSettings } from '@vctrl/core'

export interface SaveSceneOrchestratorOptions {
	includeOptimizationReport?: boolean
	initialSceneBytes?: number
	currentSceneBytes?: number
	targetProjectId?: string
	targetFolderId?: string | null
	maxConcurrentAssetUploads?: number
}

export interface SaveSceneOrchestratorResult {
	sceneId?: string
	sceneMeta?: SceneMetaState
	unchanged?: boolean
	[key: string]: unknown
}

interface ExecuteSceneSaveOrchestratorParams {
	userId?: string
	currentSceneId: null | string
	currentSettings: SceneSettings
	sceneMetaState: SceneMetaState
	optimizationSettings: unknown
	optimizationReport: null | unknown
	options?: SaveSceneOrchestratorOptions
	createRequestId: () => string
	prepareGltfDocumentForUpload: () => Promise<unknown>
	captureSceneThumbnail: () => Promise<null | string>
	maxConcurrentAssetUploadsDefault: number
}

const toJsonOrThrow = async (response: Response) => {
	const payload = await response.json()
	const billingLimitError = createBillingLimitErrorFromResponse(
		response.status,
		payload,
		`HTTP error! status: ${response.status}`
	)

	if (billingLimitError) {
		throw billingLimitError
	}

	if (!response.ok || payload.error) {
		throw new Error(payload.error || `HTTP error! status: ${response.status}`)
	}

	return payload.data || payload
}

export const executeSceneSaveOrchestrator = async ({
	userId,
	currentSceneId,
	currentSettings,
	sceneMetaState,
	optimizationSettings,
	optimizationReport,
	options,
	createRequestId,
	prepareGltfDocumentForUpload,
	captureSceneThumbnail,
	maxConcurrentAssetUploadsDefault
}: ExecuteSceneSaveOrchestratorParams): Promise<
	SaveSceneOrchestratorResult | { unchanged: true }
> => {
	if (!userId) {
		throw new Error('No user ID provided for saving settings')
	}

	const requestId = createRequestId()
	const gltfJsonToSend = await prepareGltfDocumentForUpload()
	if (!gltfJsonToSend) {
		throw new Error('Failed to prepare glTF payload for upload')
	}

	const endpoint = currentSceneId
		? `/api/scenes/${currentSceneId}`
		: '/api/scenes'

	const prepareFormData = new FormData()
	prepareFormData.append('action', 'prepare-scene-upload')
	prepareFormData.append('requestId', requestId)
	prepareFormData.append('sceneId', currentSceneId || '')

	if (options?.targetProjectId) {
		prepareFormData.append('targetProjectId', options.targetProjectId)
	}

	if (typeof options?.targetFolderId !== 'undefined') {
		prepareFormData.append('targetFolderId', options.targetFolderId ?? '')
	}

	const prepared = await toJsonOrThrow(
		await fetch(endpoint, {
			method: 'POST',
			body: prepareFormData
		})
	)

	const preparedSceneId = prepared.sceneId as string
	const preparedProjectId = prepared.projectId as string | undefined

	const thumbnailDataUrl = await captureSceneThumbnail()
	let sceneMetaForSave = sceneMetaState

	if (thumbnailDataUrl) {
		const thumbnailFile = createFileFromDataUrl(
			thumbnailDataUrl,
			'scene-thumbnail.webp'
		)

		if (thumbnailFile) {
			const uploadThumbnailFormData = new FormData()
			uploadThumbnailFormData.append('action', 'upload-scene-asset')
			uploadThumbnailFormData.append('requestId', requestId)
			uploadThumbnailFormData.append('sceneId', preparedSceneId)
			if (preparedProjectId) {
				uploadThumbnailFormData.append('projectId', preparedProjectId)
			}
			uploadThumbnailFormData.append('kind', 'image')
			uploadThumbnailFormData.append('file', thumbnailFile)

			try {
				const uploadedThumbnail = await toJsonOrThrow(
					await fetch(`/api/scenes/${preparedSceneId}`, {
						method: 'POST',
						body: uploadThumbnailFormData
					})
				)

				sceneMetaForSave = {
					...sceneMetaState,
					thumbnailUrl: `/api/scenes/${preparedSceneId}/thumbnail/${uploadedThumbnail.assetId}`
				}
			} catch (error) {
				console.warn('[scene-settings] thumbnail upload failed', {
					sceneId: preparedSceneId,
					error:
						error instanceof Error
							? error.message
							: 'Unknown thumbnail upload error'
				})
			}
		}
	}

	const maxConcurrentAssetUploads =
		options?.maxConcurrentAssetUploads ?? maxConcurrentAssetUploadsDefault

	const sceneAssetIds: string[] = []
	const gltfData = (gltfJsonToSend as { data?: unknown }).data ?? gltfJsonToSend
	const imageMimeLookup = buildImageMimeLookup(gltfData)

	const gltfAssets = (gltfJsonToSend as { assets?: unknown }).assets
	if (gltfAssets instanceof Map) {
		const gltfAssetEntries = Array.from(gltfAssets.entries())

		const uploadAsset = async ([fileName, data]: [string, unknown]) => {
			const descriptor = buildSceneUploadFileDescriptor(
				fileName,
				data,
				imageMimeLookup
			)
			const uploadAssetFormData = new FormData()
			uploadAssetFormData.append('action', 'upload-scene-asset')
			uploadAssetFormData.append('requestId', requestId)
			uploadAssetFormData.append('sceneId', preparedSceneId)
			if (preparedProjectId) {
				uploadAssetFormData.append('projectId', preparedProjectId)
			}
			uploadAssetFormData.append('kind', descriptor.kind)
			uploadAssetFormData.append('file', descriptor.file)

			const uploadedAsset = await toJsonOrThrow(
				await fetch(`/api/scenes/${preparedSceneId}`, {
					method: 'POST',
					body: uploadAssetFormData
				})
			)

			return uploadedAsset.assetId as string
		}

		for (
			let start = 0;
			start < gltfAssetEntries.length;
			start += maxConcurrentAssetUploads
		) {
			const chunk = gltfAssetEntries.slice(
				start,
				start + maxConcurrentAssetUploads
			)
			const chunkAssetIds = await Promise.all(chunk.map(uploadAsset))
			sceneAssetIds.push(...chunkAssetIds)
		}
	}

	const gltfBlob = new Blob([JSON.stringify(gltfData)], {
		type: 'model/gltf+json'
	})
	const uploadGltfFormData = new FormData()
	uploadGltfFormData.append('action', 'upload-scene-gltf')
	uploadGltfFormData.append('requestId', requestId)
	uploadGltfFormData.append('sceneId', preparedSceneId)
	if (preparedProjectId) {
		uploadGltfFormData.append('projectId', preparedProjectId)
	}
	uploadGltfFormData.append(
		'file',
		new File([gltfBlob], 'scene.gltf', { type: 'model/gltf+json' })
	)

	const uploadedGltf = await toJsonOrThrow(
		await fetch(`/api/scenes/${preparedSceneId}`, {
			method: 'POST',
			body: uploadGltfFormData
		})
	)
	sceneAssetIds.push(uploadedGltf.assetId)

	const formData = new FormData()
	formData.append('action', 'commit-scene-save')
	formData.append('requestId', requestId)
	formData.append('sceneId', preparedSceneId)
	if (preparedProjectId) {
		formData.append('projectId', preparedProjectId)
	}
	if (options?.targetProjectId) {
		formData.append('targetProjectId', options.targetProjectId)
	}

	if (typeof options?.targetFolderId !== 'undefined') {
		formData.append('targetFolderId', options.targetFolderId ?? '')
	}
	formData.append('settings', JSON.stringify(currentSettings))
	formData.append('meta', JSON.stringify(sceneMetaForSave))
	formData.append('sceneAssetIds', JSON.stringify(sceneAssetIds))
	formData.append('optimizationSettings', JSON.stringify(optimizationSettings))

	if (typeof options?.initialSceneBytes === 'number') {
		formData.append('initialSceneBytes', String(options.initialSceneBytes))
	}

	if (typeof options?.currentSceneBytes === 'number') {
		formData.append('currentSceneBytes', String(options.currentSceneBytes))
	}

	if (optimizationReport && options?.includeOptimizationReport !== false) {
		formData.append('optimizationReport', JSON.stringify(optimizationReport))
	}

	console.info('[scene-settings] save request started', {
		requestId,
		sceneId: currentSceneId || null
	})

	const data = await toJsonOrThrow(
		await fetch(endpoint, {
			method: 'POST',
			body: formData
		})
	)

	console.info('[scene-settings] save request completed', {
		requestId,
		sceneId: data.sceneId || preparedSceneId || null,
		unchanged: Boolean(data.unchanged)
	})

	if (data.unchanged) {
		return { unchanged: true }
	}

	return {
		...data,
		sceneMeta: sceneMetaForSave
	}
}
