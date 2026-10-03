import { formatFileSize } from '@shared/utils'
import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { toast } from 'sonner'

import { postFormWithProgress } from './post-form-with-progress'
import { createFileFromDataUrl } from './scene-draft-serialization'
import { planThumbnailForSave } from './scene-thumbnail-save'
import {
	buildImageMimeLookup,
	buildSceneUploadFileDescriptor
} from './scene-upload-manifest'
import {
	BillingLimitError,
	createBillingLimitErrorFromResponse,
	isBillingLimitError
} from '../../billing/client/billing-limit-error'
import { SOURCE_MODEL_FILENAME } from '../scene-asset-roles'
import { buildDefaultCameraSignature } from '../scene-camera'

import type { SaveProgressEvent } from './scene-save-progress'
import type { SourceToSave } from './scene-source-to-save'
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
	lastSavedSceneMeta: SceneMetaState | null
	lastSavedSettings: SceneSettings | null
	optimizationSettings: unknown
	optimizationReport: null | unknown
	options?: SaveSceneOrchestratorOptions
	createRequestId: () => string
	prepareGltfDocumentForUpload: () => Promise<unknown>
	captureSceneThumbnail: () => Promise<null | string>
	captureShadowBake?: () => Promise<ShadowBakeResult | null>
	onProgress?: (event: SaveProgressEvent) => void
	/** What the save does with the scene's original. Keeps none when left out. */
	source?: SourceToSave
}

/** The scene document's key, the same name `existingAssets` lists it under. */
const SCENE_DOCUMENT_KEY = 'scene.gltf'

// Pulls the asset id out of an internal thumbnail URL
// (`/api/scenes/:sceneId/thumbnail/:assetId`). Used to re-link the current
// thumbnail on every save so it isn't garbage-collected, and so a superseded one
// becomes an unlinked GC candidate.
const extractThumbnailAssetId = (
	thumbnailUrl?: string | null
): string | null => {
	if (!thumbnailUrl) return null
	// Anchor to the end so only the final `/thumbnail/<id>` segment is taken.
	const match = thumbnailUrl.match(/\/thumbnail\/([^/?#]+)$/)
	return match ? match[1] : null
}

/** The original a save left the scene keeping, and where it is read back. */
export interface KeptOriginalRef {
	assetId: string
	url: string
}

type ExistingAssets = Record<string, { assetId: string; contentHash: string }>

/** What a save does with the original once the server has said what it holds. */
type SettledSource =
	| { kind: 'none' }
	| { kind: 'linked'; assetId: string; byteSize: number }
	| { kind: 'upload'; bytes: Uint8Array }

/**
 * Re-links a stored original only while the scene still links it, which is
 * what `existingAssets` lists. On a move to another project the server reuses
 * nothing, and another session may have dropped the original meanwhile: then
 * it is sent again from the stored copy. When that cannot be read the save
 * stops, because saving without it would unlink the original for good.
 */
const settleSource = async (
	source: SourceToSave,
	existingAssets: ExistingAssets | undefined
): Promise<SettledSource> => {
	if (source.kind !== 'linked') return source

	const linked = existingAssets?.[SOURCE_MODEL_FILENAME]
	if (linked) {
		return {
			kind: 'linked',
			assetId: linked.assetId,
			byteSize: source.source.byteSize ?? 0
		}
	}

	const response = await fetch(source.source.url).catch(() => null)
	if (!response?.ok) {
		throw new Error(
			'The kept original could not be read, so nothing was saved. Try again, or turn off "Keep the original" to save without it.'
		)
	}
	return {
		kind: 'upload',
		bytes: new Uint8Array(await response.arrayBuffer())
	}
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
	lastSavedSceneMeta,
	lastSavedSettings,
	optimizationSettings,
	optimizationReport,
	options,
	createRequestId,
	prepareGltfDocumentForUpload,
	captureSceneThumbnail,
	captureShadowBake,
	onProgress,
	source = { kind: 'none' }
}: ExecuteSceneSaveOrchestratorParams): Promise<
	(SaveSceneOrchestratorResult | { unchanged: true }) & {
		/** The original the scene now keeps, or null when it keeps none. */
		keptOriginal: KeptOriginalRef | null
	}
> => {
	if (!userId) {
		throw new Error('No user ID provided for saving settings')
	}

	onProgress?.({ type: 'preparing' })
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
		prepareFormData.append(
			'currentSceneBytes',
			String(options.currentSceneBytes)
		)
	}

	const prepared = await toJsonOrThrow(
		await fetch(endpoint, {
			method: 'POST',
			body: prepareFormData
		})
	)

	const preparedSceneId = prepared.sceneId as string
	const preparedProjectId = prepared.projectId as string | undefined
	const existingAssets = prepared.existingAssets as ExistingAssets | undefined
	const settledSource = await settleSource(source, existingAssets)

	const gltfData = (gltfJsonToSend as { data?: unknown }).data ?? gltfJsonToSend
	const imageMimeLookup = buildImageMimeLookup(gltfData)
	const gltfAssets = (gltfJsonToSend as { assets?: unknown }).assets
	const assetDescriptors =
		gltfAssets instanceof Map
			? Array.from(gltfAssets.entries()).map(([fileName, data]) =>
					buildSceneUploadFileDescriptor(fileName, data, imageMimeLookup)
				)
			: []
	const gltfBytes = new Uint8Array(
		await new Blob([JSON.stringify(gltfData)], {
			type: 'model/gltf+json'
		}).arrayBuffer()
	)

	// Listed before anything uploads, so the total is known from the start.
	for (const descriptor of assetDescriptors) {
		onProgress?.({
			type: 'file-added',
			file: {
				key: descriptor.fileName,
				group: 'model',
				name: descriptor.fileName,
				bytes: descriptor.file.size,
				preview: descriptor.kind === 'image' ? descriptor.file : null
			}
		})
	}
	onProgress?.({
		type: 'file-added',
		file: {
			key: SCENE_DOCUMENT_KEY,
			group: 'model',
			name: SCENE_DOCUMENT_KEY,
			bytes: gltfBytes.byteLength,
			preview: null
		}
	})
	if (settledSource.kind !== 'none') {
		onProgress?.({
			type: 'file-added',
			file: {
				key: SOURCE_MODEL_FILENAME,
				group: 'original',
				name: 'Original model',
				bytes:
					settledSource.kind === 'upload'
						? settledSource.bytes.byteLength
						: settledSource.byteSize,
				preview: null
			}
		})
	}

	/** Uploads one file, reporting its progress under `key`. */
	const uploadFile = async (key: string, body: FormData) => {
		try {
			const uploaded = await toJsonOrThrow(
				await postFormWithProgress(
					`/api/scenes/${preparedSceneId}`,
					body,
					(fraction) => onProgress?.({ type: 'file-progress', key, fraction })
				)
			)
			onProgress?.({ type: 'file-done', key, reused: false })
			return uploaded
		} catch (error) {
			onProgress?.({ type: 'file-failed', key })
			throw error
		}
	}

	// The thumbnail is the placeholder shown while the scene loads, so it has to
	// match the frame the default camera opens on. Comparing the signature rather
	// than just the camera id means nudging the default camera's pose also
	// triggers a recapture - otherwise the saved thumbnail keeps showing the old
	// framing and the load transition visibly jumps.
	const defaultCameraChanged =
		buildDefaultCameraSignature(currentSettings.camera?.cameras) !==
		buildDefaultCameraSignature(lastSavedSettings?.camera?.cameras)
	const { capturedThumbnail, needsCapture, fallbackThumbnailUrl } =
		planThumbnailForSave({
			sceneMetaState,
			lastSavedSceneMeta,
			defaultCameraChanged
		})

	const thumbnailDataUrl =
		capturedThumbnail ?? (needsCapture ? await captureSceneThumbnail() : null)

	let sceneMetaForSave = {
		...sceneMetaState,
		thumbnailUrl: fallbackThumbnailUrl
	}

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
			onProgress?.({
				type: 'file-added',
				file: {
					key: SCENE_THUMBNAIL_FILENAME,
					group: 'preview',
					name: 'Thumbnail',
					bytes: thumbnailFile.size,
					preview: thumbnailFile
				}
			})

			try {
				const uploadedThumbnail = await uploadFile(
					SCENE_THUMBNAIL_FILENAME,
					uploadThumbnailFormData
				)

				sceneMetaForSave = {
					...sceneMetaForSave,
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
				toast.error(
					'The scene was saved, but its preview image could not be uploaded.'
				)
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
	// rides the manifest on load.
	let settingsForSave = currentSettings
	let bakedShadowAssetId: string | null = null
	const currentShadows = currentSettings.shadows
	if (captureShadowBake && currentShadows) {
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
						uploadBakeFormData.append(
							'targetProjectId',
							options.targetProjectId
						)
					}
					uploadBakeFormData.append('kind', 'image')
					uploadBakeFormData.append('file', bakeFile)
					onProgress?.({
						type: 'file-added',
						file: {
							key: PERSISTED_BAKE_FILENAME,
							group: 'preview',
							name: 'Baked shadow',
							bytes: bakeFile.size,
							preview: bakeFile
						}
					})

					const uploadedBake = await uploadFile(
						PERSISTED_BAKE_FILENAME,
						uploadBakeFormData
					)

					bakedShadowAssetId = uploadedBake.assetId as string
					bakedRef = {
						assetId: bakedShadowAssetId,
						signature: bake.signature,
						basis: bake.basis
					}
				}
			} else if (
				bake &&
				currentShadows.baked &&
				currentShadows.baked.signature === bake.signature
			) {
				// Stored bake is still valid for the current inputs: keep and relink it,
				// recording the basis it was validated against if it had none.
				bakedRef = { ...currentShadows.baked, basis: bake.basis }
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
		// The view, not `.buffer`: a view into a larger buffer would hash bytes
		// that are not the file's.
		const hashBuffer = await crypto.subtle.digest(
			'SHA-256',
			bytes as Uint8Array<ArrayBuffer>
		)
		return Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	}

	const sceneAssetIds: string[] = []

	const uploadAsset = async (descriptor: (typeof assetDescriptors)[number]) => {
		/*
		  MATCHED BY NAME, AND ONLY BY NAME. A basename pass lived here for one
		  round, so that the first save after stored assets started carrying
		  their folders would not re-upload every texture under its new name.
		  It reasoned that a name only nominates a candidate and the hash
		  decides - but the hash proves the bytes are right, never that the
		  row is, and identical bytes across folders are ordinary: a flat
		  normal map, a 1x1 white PNG, a zero-filled `.bin`.

		  What it cost: the server never renames a reused row
		  (`asset-storage.server.ts`), so a scene that reused `diffuse.png`
		  for `body/diffuse.png` while writing a fresh `wheels/diffuse.png`
		  is left half-flat and half-foldered - and in that state a
		  folderless key, which ranks last in every scope, can never win the
		  name-only rung again. Both materials then load the wheels texture,
		  saved and reported as success, which is verbatim the defect
		  `buildSceneUploadFileDescriptor` exists to end. Two names
		  nominating one row could also put the same id in `sceneAssetIds`
		  twice, which fails the save outright - not at `scene_assets`'
		  composite primary key, which never gets the chance, but at
		  `assertAssetsBelongToProject`, where a repeated id makes the
		  selected rows fewer than the ids asked for and the save reports
		  "One or more uploaded assets are missing".

		  So the re-upload stays. It is the same cost as editing a texture,
		  paid once per scene, and it keeps every stored name equal to the
		  URI that resolves it.
		*/
		const existing = existingAssets?.[descriptor.fileName]

		if (existing) {
			const bytes = new Uint8Array(await descriptor.file.arrayBuffer())
			const hash = await hashBytes(bytes)
			if (hash === existing.contentHash) {
				onProgress?.({
					type: 'file-done',
					key: descriptor.fileName,
					reused: true
				})
				return existing.assetId
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

		const uploadedAsset = await uploadFile(
			descriptor.fileName,
			uploadAssetFormData
		)

		return uploadedAsset.assetId as string
	}

	for (
		let start = 0;
		start < assetDescriptors.length;
		start += maxConcurrentAssetUploads
	) {
		const chunk = assetDescriptors.slice(
			start,
			start + maxConcurrentAssetUploads
		)
		const chunkAssetIds = await Promise.all(chunk.map(uploadAsset))
		sceneAssetIds.push(...chunkAssetIds)
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
			new File([bytes.buffer as ArrayBuffer], SCENE_DOCUMENT_KEY, {
				type: 'model/gltf+json'
			})
		)
		const uploadedGltf = await uploadFile(
			SCENE_DOCUMENT_KEY,
			uploadGltfFormData
		)
		return uploadedGltf.assetId as string
	}

	let gltfAssetId: string
	const existingGltf = existingAssets?.[SCENE_DOCUMENT_KEY]
	if (existingGltf) {
		const hash = await hashBytes(gltfBytes)
		if (hash === existingGltf.contentHash) {
			gltfAssetId = existingGltf.assetId
			onProgress?.({ type: 'file-done', key: SCENE_DOCUMENT_KEY, reused: true })
		} else {
			gltfAssetId = await uploadGltfFile(gltfBytes)
		}
	} else {
		gltfAssetId = await uploadGltfFile(gltfBytes)
	}
	sceneAssetIds.push(gltfAssetId)

	// The original is linked apart from the model's assets, so it is never
	// loaded as part of the model. A stored one is re-linked without sending
	// it; a source whose bytes the server already holds is not sent either.
	let sourceAssetId: string | null = null
	if (settledSource.kind === 'linked') {
		sourceAssetId = settledSource.assetId
		onProgress?.({
			type: 'file-done',
			key: SOURCE_MODEL_FILENAME,
			reused: true
		})
	} else if (settledSource.kind === 'upload') {
		const existingSource = existingAssets?.[SOURCE_MODEL_FILENAME]
		if (
			existingSource &&
			(await hashBytes(settledSource.bytes)) === existingSource.contentHash
		) {
			sourceAssetId = existingSource.assetId
			onProgress?.({
				type: 'file-done',
				key: SOURCE_MODEL_FILENAME,
				reused: true
			})
		} else {
			const uploadSourceFormData = new FormData()
			uploadSourceFormData.append('action', 'upload-scene-asset')
			uploadSourceFormData.append('requestId', requestId)
			uploadSourceFormData.append('sceneId', preparedSceneId)
			if (preparedProjectId) {
				uploadSourceFormData.append('projectId', preparedProjectId)
			}
			if (options?.targetProjectId) {
				uploadSourceFormData.append('targetProjectId', options.targetProjectId)
			}
			uploadSourceFormData.append('kind', 'buffer')
			uploadSourceFormData.append(
				'file',
				new File(
					[settledSource.bytes as Uint8Array<ArrayBuffer>],
					SOURCE_MODEL_FILENAME,
					{
						type: 'model/gltf-binary'
					}
				)
			)
			const uploadedSource = await uploadFile(
				SOURCE_MODEL_FILENAME,
				uploadSourceFormData
			).catch((error: unknown) => {
				// Keeping the original is on by default, so a limit it alone hits
				// would otherwise read as the scene not fitting at all.
				if (!isBillingLimitError(error)) throw error
				throw new BillingLimitError({
					reason: error.reason,
					status: error.status,
					quota: error.quota,
					message: `${error.message} Keeping the original adds ${formatFileSize(settledSource.bytes.byteLength)}; turn off "Keep the original" to save without it.`
				})
			})
			sourceAssetId = uploadedSource.assetId as string
		}
	}

	// Link the persisted shadow bake into the scene's asset set so the server
	// downloads it into the manifest (base64-inlined alongside the model assets)
	// and every surface loads it in parallel, with no separate request.
	if (bakedShadowAssetId) {
		sceneAssetIds.push(bakedShadowAssetId)
	}

	// Link the current thumbnail (newly uploaded or the existing one) so it is
	// tracked as a scene asset: this keeps it from being GC'd and lets a superseded
	// thumbnail become an unlinked GC candidate. It is excluded from the manifest's
	// inlined render data server-side (served by URL, not rendered).
	const thumbnailAssetId = extractThumbnailAssetId(
		sceneMetaForSave.thumbnailUrl
	)
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
	if (sourceAssetId) {
		formData.append('sourceAssetId', sourceAssetId)
	}
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

	// The same address the publisher's manifest gives a scene asset.
	const keptOriginal: KeptOriginalRef | null = sourceAssetId
		? {
				assetId: sourceAssetId,
				url: `/api/scenes/${preparedSceneId}/assets/${sourceAssetId}`
			}
		: null

	onProgress?.({ type: 'committing' })
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

	onProgress?.({ type: 'saved', unchanged: Boolean(data.unchanged) })

	if (data.unchanged) {
		return { unchanged: true, keptOriginal }
	}

	return {
		...data,
		sceneMeta: sceneMetaForSave,
		keptOriginal
	}
}
