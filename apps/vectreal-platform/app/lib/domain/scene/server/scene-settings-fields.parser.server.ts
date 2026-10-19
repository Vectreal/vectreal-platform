import { JSONDocument } from '@gltf-transform/core'
import { ApiResponse } from '@shared/utils'
import { OptimizationReport, Optimizations } from '@vctrl/core'

import { UUID_REGEX } from '../../../../constants/utility-constants'
import { parseOptimizationReport } from '../optimization-report-guard'
import {
	buildSceneThumbnailUrl,
	thumbnailAssetIdFromUrl
} from '../scene-thumbnail-url'

import type { SceneMetaState } from '../../../../types/publisher-config'

/**
 * Parses GLTF JSON from request.
 */
export function parseGltfJson(
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
				console.warn('Failed to parse gltfJson:', error)
				return ApiResponse.badRequest('Invalid gltfJson format')
			}
		}
	}

	// Return undefined if no gltfJson provided (it's optional for some operations)
	return gltf || undefined
}

export function parseSceneMeta(
	requestData: Record<string, unknown>
): SceneMetaState | Response {
	const fallbackMeta: SceneMetaState = {
		name: '',
		description: '',
		thumbnailUrl: ''
	}

	if (!requestData.meta) {
		return fallbackMeta
	}

	let payload: unknown = requestData.meta

	if (typeof payload === 'string') {
		try {
			payload = JSON.parse(payload)
		} catch (error) {
			console.warn('Failed to parse scene meta:', error)
			return ApiResponse.badRequest('Invalid scene metadata format')
		}
	}

	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return ApiResponse.badRequest('Invalid scene metadata format')
	}

	const candidate = payload as {
		name?: unknown
		description?: unknown
		thumbnailUrl?: unknown
	}

	return {
		name: typeof candidate.name === 'string' ? candidate.name : '',
		description:
			typeof candidate.description === 'string' ? candidate.description : '',
		thumbnailUrl:
			typeof candidate.thumbnailUrl === 'string' ? candidate.thumbnailUrl : ''
	}
}

/**
 * Parses the optimization report from the request, and checks it.
 *
 * This payload comes from the browser and is persisted into `scene_stats`
 * verbatim. The object branch used to accept it on `typeof === 'object'` and
 * cast, and the string branch checked only that `JSON.parse` returned a
 * non-null object - so a truncated body reached
 * `createSceneStatsFromReport`, which dereferences two levels deep, and came
 * back as a 500 rather than a 400.
 *
 * Both branches now go through the same guard, because they were two spellings
 * of one payload and only one of them was ever checked.
 */
export function parseOptimizationReportField(
	requestData: Record<string, unknown>
): OptimizationReport | undefined | Response {
	if (!requestData.optimizationReport) {
		return undefined
	}

	let payload: unknown = requestData.optimizationReport

	if (typeof payload === 'string') {
		try {
			payload = JSON.parse(payload)
		} catch (error) {
			console.warn('Failed to parse optimizationReport:', error)
			return ApiResponse.badRequest('Invalid optimization report format')
		}
	}

	const report = parseOptimizationReport(payload)

	if (!report) {
		return ApiResponse.badRequest('Invalid optimization report format')
	}

	return report
}

export function parseOptimizationSettings(
	requestData: Record<string, unknown>
): Optimizations | undefined | Response {
	if (!requestData.optimizationSettings) {
		return undefined
	}

	if (typeof requestData.optimizationSettings === 'string') {
		try {
			const parsed = JSON.parse(requestData.optimizationSettings)
			if (typeof parsed !== 'object' || parsed === null) {
				return ApiResponse.badRequest('Invalid optimization settings format')
			}

			return parsed as Optimizations
		} catch (error) {
			console.warn('Failed to parse optimizationSettings:', error)
			return ApiResponse.badRequest('Invalid optimization settings format')
		}
	}

	if (typeof requestData.optimizationSettings === 'object') {
		return requestData.optimizationSettings as Optimizations
	}

	return undefined
}

export function parseSceneAssetIds(
	requestData: Record<string, unknown>
): string[] | Response {
	const rawSceneAssetIds = requestData.sceneAssetIds

	if (!rawSceneAssetIds) {
		return ApiResponse.badRequest('sceneAssetIds is required')
	}

	let sceneAssetIds: unknown = rawSceneAssetIds
	if (typeof rawSceneAssetIds === 'string') {
		try {
			sceneAssetIds = JSON.parse(rawSceneAssetIds)
		} catch {
			return ApiResponse.badRequest('sceneAssetIds must be a valid JSON array')
		}
	}

	if (!Array.isArray(sceneAssetIds) || sceneAssetIds.length === 0) {
		return ApiResponse.badRequest('sceneAssetIds must be a non-empty array')
	}

	const normalizedIds = sceneAssetIds
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.trim())
		.filter(Boolean)

	if (normalizedIds.length !== sceneAssetIds.length) {
		return ApiResponse.badRequest('sceneAssetIds contains invalid values')
	}

	if (!normalizedIds.every((assetId) => UUID_REGEX.test(assetId))) {
		return ApiResponse.badRequest('sceneAssetIds must contain valid UUIDs')
	}

	return normalizedIds
}

/**
 * The kept original, optional. It is linked under its own role, so it must
 * not also arrive as one of the model's assets: one asset cannot be linked
 * twice to one scene, and it would be served as part of the model.
 */
export function parseSourceAssetId(
	requestData: Record<string, unknown>,
	sceneAssetIds: string[]
): string | undefined | Response {
	const raw = requestData.sourceAssetId
	if (raw === undefined || raw === null || raw === '') return undefined

	if (typeof raw !== 'string' || !UUID_REGEX.test(raw.trim())) {
		return ApiResponse.badRequest('sourceAssetId must be a valid UUID')
	}

	const sourceAssetId = raw.trim()
	if (sceneAssetIds.includes(sourceAssetId)) {
		return ApiResponse.badRequest(
			'sourceAssetId must not also be one of sceneAssetIds'
		)
	}

	return sourceAssetId
}

/**
 * The thumbnail a commit stores in `scenes.thumbnail_url`.
 *
 * Empty means none. Anything else must be this scene's thumbnail route for
 * an asset the same commit links, which the save then checks belongs to the
 * scene's project. Stored unexamined, the column could name any asset id,
 * and the GC counts every asset it names as in use.
 */
export function parseThumbnailUrl(
	raw: string,
	sceneId: string | undefined,
	sceneAssetIds: string[]
): string | Response {
	const thumbnailUrl = raw.trim()
	if (!thumbnailUrl) return ''

	const assetId = thumbnailAssetIdFromUrl(thumbnailUrl)
	const isLinkedThumbnail =
		sceneId !== undefined &&
		assetId !== null &&
		sceneAssetIds.includes(assetId) &&
		thumbnailUrl === buildSceneThumbnailUrl(sceneId, assetId)

	if (!isLinkedThumbnail) {
		return ApiResponse.badRequest(
			"meta.thumbnailUrl must be this scene's thumbnail for an asset the save links"
		)
	}

	return thumbnailUrl
}

export function parsePublishedAssetId(
	requestData: Record<string, unknown>
): string | Response {
	const rawPublishedAssetId = requestData.publishedAssetId
	if (typeof rawPublishedAssetId !== 'string') {
		return ApiResponse.badRequest('publishedAssetId is required')
	}

	const publishedAssetId = rawPublishedAssetId.trim()
	if (!publishedAssetId) {
		return ApiResponse.badRequest('publishedAssetId is required')
	}

	if (!UUID_REGEX.test(publishedAssetId)) {
		return ApiResponse.badRequest('publishedAssetId must be a valid UUID')
	}

	return publishedAssetId
}

export function parseInitialSceneBytes(
	requestData: Record<string, unknown>
): number | undefined | Response {
	const rawInitialSceneBytes = requestData.initialSceneBytes

	if (rawInitialSceneBytes == null) {
		return undefined
	}

	const parsedValue =
		typeof rawInitialSceneBytes === 'number'
			? rawInitialSceneBytes
			: typeof rawInitialSceneBytes === 'string'
				? Number(rawInitialSceneBytes)
				: NaN

	if (!Number.isFinite(parsedValue) || parsedValue < 0) {
		return ApiResponse.badRequest(
			'initialSceneBytes must be a non-negative number'
		)
	}

	return Math.round(parsedValue)
}

export function parseTargetProjectId(
	requestData: Record<string, unknown>
): string | undefined | Response {
	const rawTargetProjectId = requestData.targetProjectId
	if (typeof rawTargetProjectId === 'undefined') {
		return undefined
	}

	if (typeof rawTargetProjectId !== 'string') {
		return ApiResponse.badRequest('targetProjectId must be a valid UUID')
	}

	const targetProjectId = rawTargetProjectId.trim()
	if (!targetProjectId) {
		return undefined
	}

	if (!UUID_REGEX.test(targetProjectId)) {
		return ApiResponse.badRequest('targetProjectId must be a valid UUID')
	}

	return targetProjectId
}

export function parseProjectId(
	requestData: Record<string, unknown>
): string | undefined | Response {
	const rawProjectId = requestData.projectId
	if (typeof rawProjectId === 'undefined') {
		return undefined
	}

	if (typeof rawProjectId !== 'string') {
		return ApiResponse.badRequest('projectId must be a valid UUID')
	}

	const projectId = rawProjectId.trim()
	if (!projectId) {
		return undefined
	}

	if (!UUID_REGEX.test(projectId)) {
		return ApiResponse.badRequest('projectId must be a valid UUID')
	}

	return projectId
}

export function parseTargetFolderId(
	requestData: Record<string, unknown>
): string | null | undefined | Response {
	const rawTargetFolderId = requestData.targetFolderId
	if (typeof rawTargetFolderId === 'undefined') {
		return undefined
	}

	if (typeof rawTargetFolderId !== 'string') {
		return ApiResponse.badRequest('targetFolderId must be a valid UUID')
	}

	const targetFolderId = rawTargetFolderId.trim()
	if (!targetFolderId) {
		return null
	}

	if (!UUID_REGEX.test(targetFolderId)) {
		return ApiResponse.badRequest('targetFolderId must be a valid UUID')
	}

	return targetFolderId
}
