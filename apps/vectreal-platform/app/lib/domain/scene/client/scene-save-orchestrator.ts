import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { createFileFromDataUrl } from './scene-draft-serialization'
import {
	buildImageMimeLookup,
	buildSceneUploadFileDescriptor
} from './scene-upload-manifest'
import { createBillingLimitErrorFromResponse } from '../../billing/client/billing-limit-error'

import type { SceneMetaState } from '../../../../types/publisher-config'
import type { SceneSettings } from '@vctrl/core'
import type { ShadowBakeResult } from '@vctrl/viewer'

/**
 * How many scene assets to upload in parallel. Single source of truth for the
 * save pipeline's concurrency; a per-call `options.maxConcurrentAssetUploads`
 * may override it. Kept here because the orchestrator is the only consumer.
 */
export const MAX_CONCURRENT_ASSET_UPLOADS = 4

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
	lastSavedSettings: SceneSettings | null
	optimizationSettings: unknown
	optimizationReport: null | unknown
	options?: SaveSceneOrchestratorOptions
	createRequestId: () => string
	prepareGltfDocumentForUpload: () => Promise<unknown>
	captureSceneThumbnail: () => Promise<null | string>
	captureShadowBake?: () => Promise<ShadowBakeResult | null>
}

// Pulls the asset id out of an internal thumbnail URL
// (`/api/scenes/:sceneId/thumbnail/:assetId`). Used to re-link the current
// thumbnail on every save so it isn't garbage-collected, and so a superseded one
// becomes an unlinked GC candidate.
const extractThumbnailAssetId = (thumbnailUrl?: string | null): string | null => {
	if (!thumbnailUrl) return null
	// Anchor to the end so only the final `/thumbnail/<id>` segment is taken.
	const match = thumbnailUrl.match(/\/thumbnail\/([^/?#]+)$/)
	return match ? match[1] : null
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
	lastSavedSettings,
	optimizationSettings,
	optimizationReport,
	options,
	createRequestId,
	prepareGltfDocumentForUpload,
	captureSceneThumbnail,
	captureShadowBake
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

	if (typeof options?.currentSceneBytes === 'number') {
		prepareFormData.append('currentSceneBytes', String(options.currentSceneBytes))
	}

	const prepared = await toJsonOrThrow(
		await fetch(endpoint, {
			method: 'POST',
			body: prepareFormData
		})
	)

	const preparedSceneId = prepared.sceneId as string
	const preparedProjectId = prepared.projectId as string | undefined
	const existingAssets = prepared.existingAssets as
		| Record<string, { assetId: string; contentHash: string }>
		| undefined

	const currentDefaultCameraId =
		currentSettings.camera?.cameras?.find((c) => !c.kind || c.kind === 'scene')
			?.cameraId ?? currentSettings.camera?.cameras?.[0]?.cameraId
	const lastSavedDefaultCameraId =
		lastSavedSettings?.camera?.cameras?.find(
			(c) => !c.kind || c.kind === 'scene'
		)?.cameraId ?? lastSavedSettings?.camera?.cameras?.[0]?.cameraId
	const defaultCameraChanged =
		currentDefaultCameraId !== lastSavedDefaultCameraId
	const needsThumbnail = !sceneMetaState.thumbnailUrl || defaultCameraChanged

	const thumbnailDataUrl = needsThumbnail ? await captureSceneThumbnail() : null
	let sceneMetaForSave = sceneMetaState

	if (thumbnailDataUrl) {
		const thumbnailFile = createFileFromDataUrl(
			thumbnailDataUrl,
			SCENE_THUMBNAIL_FILENAME
		)

		if (thumbnailFile) {
			const uploadThumbnailFormData = new FormData()
			uploadThumbnailFormData.append('action', 'upload-scene-asset')
			uploadThumbnailFormData.append('requestId', requestId)
			uploadThumbnailFormData.append('sceneId', preparedSceneId)
			if (preparedProjectId) {
				uploadThumbnailFormData.append('projectId', preparedProjectId)
			}
			if (options?.targetProjectId) {
				uploadThumbnailFormData.append(
					'targetProjectId',
					options.targetProjectId
				)
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

	// Persist / refresh the accumulative shadow bake so the scene loads without
	// recomputing it. The capture reports the bake state for the CURRENT inputs:
	//  - a fresh density PNG (`dataUrl`) → upload it and reference the new asset,
	//  - `dataUrl` null with a matching signature → the stored bake is still valid;
	//    keep its asset (the bake is non-deterministic, so re-uploading would churn
	//    storage and trigger needless GC),
	//  - nothing settled → drop any persisted ref so a STALE bake is never shipped;
	//    the scene re-bakes live next load and re-persists once it settles.
	// Best-effort: any failure leaves the scene to re-bake live next load. The bake
	// asset id (fresh or kept) is linked into the scene's asset set (below) so it
	// rides the aggregate on load.
	let settingsForSave = currentSettings
	let bakedShadowAssetId: string | null = null
	const currentShadows = currentSettings.shadows
	if (captureShadowBake && currentShadows?.type === 'accumulative') {
		let bakedRef: typeof currentShadows.baked | undefined
		try {
			const bake = await captureShadowBake()
			if (bake?.dataUrl) {
				const bakeFile = createFileFromDataUrl(
					bake.dataUrl,
					PERSISTED_BAKE_FILENAME
				)
				if (bakeFile) {
					const uploadBakeFormData = new FormData()
					uploadBakeFormData.append('action', 'upload-scene-asset')
					uploadBakeFormData.append('requestId', requestId)
					uploadBakeFormData.append('sceneId', preparedSceneId)
					if (preparedProjectId) {
						uploadBakeFormData.append('projectId', preparedProjectId)
					}
					if (options?.targetProjectId) {
						uploadBakeFormData.append('targetProjectId', options.targetProjectId)
					}
					uploadBakeFormData.append('kind', 'image')
					uploadBakeFormData.append('file', bakeFile)

					const uploadedBake = await toJsonOrThrow(
						await fetch(`/api/scenes/${preparedSceneId}`, {
							method: 'POST',
							body: uploadBakeFormData
						})
					)

					bakedShadowAssetId = uploadedBake.assetId as string
					bakedRef = { assetId: bakedShadowAssetId, signature: bake.signature }
				}
			} else if (
				bake &&
				currentShadows.baked &&
				currentShadows.baked.signature === bake.signature
			) {
				// Stored bake is still valid for the current inputs: keep and relink it.
				bakedRef = currentShadows.baked
				bakedShadowAssetId = currentShadows.baked.assetId
			}
		} catch (error) {
			console.warn('[scene-settings] shadow bake persist failed', {
				sceneId: preparedSceneId,
				error:
					error instanceof Error ? error.message : 'Unknown shadow bake error'
			})
		}

		settingsForSave = {
			...currentSettings,
			shadows: { ...currentShadows, baked: bakedRef }
		}
	}

	const maxConcurrentAssetUploads =
		options?.maxConcurrentAssetUploads ?? MAX_CONCURRENT_ASSET_UPLOADS

	const hashBytes = async (bytes: Uint8Array): Promise<string> => {
		const hashBuffer = await crypto.subtle.digest(
			'SHA-256',
			bytes.buffer as ArrayBuffer
		)
		return Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	}

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

			if (existingAssets?.[descriptor.fileName]) {
				const bytes = new Uint8Array(await descriptor.file.arrayBuffer())
				const hash = await hashBytes(bytes)
				if (hash === existingAssets[descriptor.fileName].contentHash) {
					return existingAssets[descriptor.fileName].assetId
				}
			}

			const uploadAssetFormData = new FormData()
			uploadAssetFormData.append('action', 'upload-scene-asset')
			uploadAssetFormData.append('requestId', requestId)
			uploadAssetFormData.append('sceneId', preparedSceneId)
			if (preparedProjectId) {
				uploadAssetFormData.append('projectId', preparedProjectId)
			}
			if (options?.targetProjectId) {
				uploadAssetFormData.append('targetProjectId', options.targetProjectId)
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

	const uploadGltfFile = async (bytes: Uint8Array): Promise<string> => {
		const uploadGltfFormData = new FormData()
		uploadGltfFormData.append('action', 'upload-scene-gltf')
		uploadGltfFormData.append('requestId', requestId)
		uploadGltfFormData.append('sceneId', preparedSceneId)
		if (preparedProjectId) {
			uploadGltfFormData.append('projectId', preparedProjectId)
		}
		if (options?.targetProjectId) {
			uploadGltfFormData.append('targetProjectId', options.targetProjectId)
		}
		uploadGltfFormData.append(
			'file',
			new File([bytes.buffer as ArrayBuffer], 'scene.gltf', {
				type: 'model/gltf+json'
			})
		)
		const uploadedGltf = await toJsonOrThrow(
			await fetch(`/api/scenes/${preparedSceneId}`, {
				method: 'POST',
				body: uploadGltfFormData
			})
		)
		return uploadedGltf.assetId as string
	}

	const gltfBlob = new Blob([JSON.stringify(gltfData)], {
		type: 'model/gltf+json'
	})
	const gltfBytes = new Uint8Array(await gltfBlob.arrayBuffer())

	let gltfAssetId: string
	const existingGltf = existingAssets?.['scene.gltf']
	if (existingGltf) {
		const hash = await hashBytes(gltfBytes)
		if (hash === existingGltf.contentHash) {
			gltfAssetId = existingGltf.assetId
		} else {
			gltfAssetId = await uploadGltfFile(gltfBytes)
		}
	} else {
		gltfAssetId = await uploadGltfFile(gltfBytes)
	}
	sceneAssetIds.push(gltfAssetId)

	// Link the persisted shadow bake into the scene's asset set so the server
	// downloads it into the aggregate (base64-inlined alongside the model assets)
	// and every surface loads it in parallel, with no separate request.
	if (bakedShadowAssetId) {
		sceneAssetIds.push(bakedShadowAssetId)
	}

	// Link the current thumbnail (newly uploaded or the existing one) so it is
	// tracked as a scene asset: this keeps it from being GC'd and lets a superseded
	// thumbnail become an unlinked GC candidate. It is excluded from the aggregate's
	// inlined render data server-side (served by URL, not rendered).
	const thumbnailAssetId = extractThumbnailAssetId(sceneMetaForSave.thumbnailUrl)
	if (thumbnailAssetId) {
		sceneAssetIds.push(thumbnailAssetId)
	}

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
	formData.append('settings', JSON.stringify(settingsForSave))
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
