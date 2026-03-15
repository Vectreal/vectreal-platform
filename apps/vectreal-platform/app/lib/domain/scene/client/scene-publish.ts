import { buildSceneUploadFileDescriptor } from './scene-upload-manifest'
import { createBillingLimitErrorFromResponse } from '../../billing/client/billing-limit-error'

import type {
	PublishSceneResponse,
	ScenePublishStateResponse
} from '../../../../types/api'

interface PublishSceneFromGlbInput {
	sceneId: string
	baseFileName: string
	glbData: Uint8Array
	currentSceneBytes?: number
}

interface PublishSceneFromGlbResult {
	publishState: ScenePublishStateResponse
	response: PublishSceneResponse
}

function normalizeError(payload: unknown, status: number, fallback: string) {
	if (
		typeof payload === 'object' &&
		payload !== null &&
		'error' in payload &&
		typeof (payload as { error?: unknown }).error === 'string'
	) {
		return (payload as { error: string }).error
	}

	return `${fallback} (${status})`
}

export async function publishSceneFromGlb({
	sceneId,
	baseFileName,
	glbData,
	currentSceneBytes
}: PublishSceneFromGlbInput): Promise<PublishSceneFromGlbResult> {
	const uploadFormData = new FormData()
	uploadFormData.append('action', 'upload-published-glb')
	uploadFormData.append('sceneId', sceneId)
	const uploadDescriptor = buildSceneUploadFileDescriptor(
		`${baseFileName}.glb`,
		glbData
	)
	uploadFormData.append('file', uploadDescriptor.file)

	const uploadResponse = await fetch(`/api/scenes/${sceneId}`, {
		method: 'POST',
		body: uploadFormData
	})

	const uploadPayload = await uploadResponse.json()
	const uploadBillingLimitError = createBillingLimitErrorFromResponse(
		uploadResponse.status,
		uploadPayload,
		'Failed to upload GLB'
	)
	if (uploadBillingLimitError) {
		throw uploadBillingLimitError
	}

	if (!uploadResponse.ok) {
		throw new Error(
			normalizeError(
				uploadPayload,
				uploadResponse.status,
				'Failed to upload GLB'
			)
		)
	}

	const uploadedAsset =
		typeof uploadPayload === 'object' &&
		uploadPayload !== null &&
		'data' in uploadPayload
			? (uploadPayload as { data?: { assetId?: string } }).data
			: (uploadPayload as { assetId?: string })

	if (!uploadedAsset?.assetId) {
		throw new Error('Upload response is missing assetId')
	}

	const publishFormData = new FormData()
	publishFormData.append('action', 'commit-scene-publish')
	publishFormData.append('sceneId', sceneId)
	publishFormData.append('publishedAssetId', uploadedAsset.assetId)
	if (Number.isFinite(currentSceneBytes)) {
		publishFormData.append('currentSceneBytes', String(currentSceneBytes))
	}

	const publishResponse = await fetch(`/api/scenes/${sceneId}`, {
		method: 'POST',
		body: publishFormData
	})

	const publishPayload = await publishResponse.json()
	const publishBillingLimitError = createBillingLimitErrorFromResponse(
		publishResponse.status,
		publishPayload,
		'Failed to publish scene'
	)
	if (publishBillingLimitError) {
		throw publishBillingLimitError
	}

	if (!publishResponse.ok) {
		throw new Error(
			normalizeError(
				publishPayload,
				publishResponse.status,
				'Failed to publish scene'
			)
		)
	}

	const publishData =
		typeof publishPayload === 'object' &&
		publishPayload !== null &&
		'data' in publishPayload
			? ((publishPayload as { data?: PublishSceneResponse }).data ??
				(publishPayload as PublishSceneResponse))
			: (publishPayload as PublishSceneResponse)

	const publishedAt =
		typeof publishData.publishedAt === 'string'
			? publishData.publishedAt
			: publishData.publishedAt instanceof Date
				? publishData.publishedAt.toISOString()
				: new Date().toISOString()

	return {
		response: publishData,
		publishState: {
			sceneId,
			status: 'published',
			publishedAt,
			publishedAssetId: uploadedAsset.assetId,
			publishedAssetSizeBytes:
				typeof currentSceneBytes === 'number' ? currentSceneBytes : null
		}
	}
}
