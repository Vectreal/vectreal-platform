import { ApiResponse } from '@shared/utils'

import {
	parseGltfJson,
	parseInitialSceneBytes,
	parseOptimizationReportField,
	parseOptimizationSettings,
	parseProjectId,
	parsePublishedAssetId,
	parseSceneAssetIds,
	parseSceneMeta,
	parseSourceAssetId,
	parseStudioFinish,
	parseTargetFolderId,
	parseTargetProjectId,
	parseThumbnailUrl
} from './scene-settings-fields.parser.server'
import { checkHotspotArtwork } from './scene-settings-hotspots.parser.server'
import { parseSettingsData } from './scene-settings-payload.parser.server'
import { UUID_REGEX } from '../../../../constants/utility-constants'
import { normalizePresentationSettings } from '../scene-presentation'

import type { SceneSettingsRequest } from '../../../../types/api'
import type { ScenePresentationSettings } from '@vctrl/core'

/** The ids an upload or prepare action carries; it has no settings payload. */
export interface SceneUploadRequest {
	action: string
	requestId: string | undefined
	projectId: string | undefined
	sceneId: string | undefined
	targetProjectId: string | undefined
	targetFolderId: string | null | undefined
}

/**
 * Request parser for scene settings API operations.
 * Handles validation and normalization of incoming requests.
 *
 * This module owns which action needs which fields. The settings payload is
 * parsed in `scene-settings-payload.parser.server.ts`, the camera block and
 * its transition in `scene-settings-camera.parser.server.ts`, hotspots in
 * `scene-settings-hotspots.parser.server.ts`, and every other top-level field
 * in `scene-settings-fields.parser.server.ts`.
 */
export class SceneSettingsParser {
	/**
	 * The dashboard's inline title and description edit. A blank name is
	 * refused; a description that is not a string is stored as none.
	 */
	static parseSceneMetadataUpdate(
		requestData: Record<string, unknown>
	): { name: string; description: string | null } | Response {
		const nameRaw = requestData.name
		const descriptionRaw = requestData.description

		const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
		const description =
			typeof descriptionRaw === 'string' ? descriptionRaw : null

		if (!name) {
			return ApiResponse.badRequest('Scene name is required')
		}

		return { name, description }
	}

	/** The dashboard's single-field presentation write. */
	static parseScenePresentationUpdate(
		requestData: Record<string, unknown>
	): ScenePresentationSettings | Response {
		const presentation = normalizePresentationSettings(requestData.presentation)
		if (!presentation) {
			return ApiResponse.badRequest('Presentation settings are required')
		}

		return presentation
	}

	/**
	 * The ids an upload or prepare action names. Read leniently, unlike the
	 * commit actions: a value that is not a string is treated as absent, and
	 * the operations check ownership of whatever survives. A body without a
	 * `sceneId` string falls back to the route's.
	 */
	static parseSceneUploadRequest(
		requestData: Record<string, unknown>,
		action: string,
		routeSceneId: string | undefined
	): SceneUploadRequest {
		return {
			action,
			requestId:
				typeof requestData.requestId === 'string'
					? requestData.requestId.trim()
					: undefined,
			projectId:
				typeof requestData.projectId === 'string'
					? requestData.projectId.trim() || undefined
					: undefined,
			sceneId:
				typeof requestData.sceneId === 'string'
					? requestData.sceneId.trim() || undefined
					: routeSceneId,
			targetProjectId:
				typeof requestData.targetProjectId === 'string'
					? requestData.targetProjectId.trim() || undefined
					: undefined,
			targetFolderId:
				typeof requestData.targetFolderId === 'string'
					? requestData.targetFolderId.trim() || null
					: undefined
		}
	}

	static parseSceneSettingsRequestData(
		requestData: Record<string, unknown>
	): SceneSettingsRequest | Response {
		try {
			// Extract required fields
			const action = requestData.action as string
			const rawRequestId = requestData.requestId as string
			const requestId =
				typeof rawRequestId === 'string' ? rawRequestId.trim() : undefined
			const rawSceneId = requestData.sceneId as string
			const sceneId =
				typeof rawSceneId === 'string' ? rawSceneId.trim() : rawSceneId
			const projectId = parseProjectId(requestData)
			if (projectId instanceof Response) {
				return projectId
			}
			const targetProjectId = parseTargetProjectId(requestData)
			if (targetProjectId instanceof Response) {
				return targetProjectId
			}
			const targetFolderId = parseTargetFolderId(requestData)
			if (targetFolderId instanceof Response) {
				return targetFolderId
			}

			// Validate required fields
			if (!action) {
				return ApiResponse.badRequest('Action is required')
			}

			const sceneIdValidation = this.validateSceneId(action, sceneId)
			if (sceneIdValidation instanceof Response) {
				return sceneIdValidation
			}

			// For lightweight read actions, we don't need settings payload
			if (action === 'get-scene-settings') {
				return {
					action,
					requestId,
					projectId,
					sceneId,
					targetProjectId: undefined,
					targetFolderId: undefined,
					settings: undefined,
					gltfJson: undefined
				}
			}

			if (action === 'revoke-scene-publish') {
				return {
					action,
					requestId,
					projectId,
					sceneId,
					targetProjectId: undefined,
					targetFolderId: undefined,
					settings: undefined,
					gltfJson: undefined
				}
			}

			if (action === 'publish-scene') {
				return ApiResponse.badRequest(
					'publish-scene is no longer supported. Use upload-published-glb + commit-scene-publish.'
				)
			}

			if (action === 'commit-scene-publish') {
				const publishedAssetId = parsePublishedAssetId(requestData)
				if (publishedAssetId instanceof Response) {
					return publishedAssetId
				}
				return {
					action,
					requestId,
					projectId,
					sceneId,
					targetProjectId: undefined,
					targetFolderId: undefined,
					settings: undefined,
					gltfJson: undefined,
					publishedAssetId
				}
			}

			if (action === 'save-scene-settings') {
				return ApiResponse.badRequest(
					'save-scene-settings is no longer supported. Use upload-scene-asset/upload-scene-gltf + commit-scene-save.'
				)
			}

			// Parse settings data (required for save operations)
			const settings = parseSettingsData(requestData)
			if (settings instanceof Response) {
				return settings
			}

			const gltfJsonData = parseGltfJson(requestData)
			if (gltfJsonData instanceof Response) {
				return gltfJsonData
			}

			const optimizationReport = parseOptimizationReportField(requestData)
			if (optimizationReport instanceof Response) {
				return optimizationReport
			}

			const optimizationSettings = parseOptimizationSettings(requestData)
			if (optimizationSettings instanceof Response) {
				return optimizationSettings
			}

			const initialSceneBytes = parseInitialSceneBytes(requestData)
			if (initialSceneBytes instanceof Response) {
				return initialSceneBytes
			}

			const meta = parseSceneMeta(requestData)
			if (meta instanceof Response) {
				return meta
			}

			if (action === 'commit-scene-save') {
				const sceneAssetIds = parseSceneAssetIds(requestData)
				if (sceneAssetIds instanceof Response) {
					return sceneAssetIds
				}

				const sourceAssetId = parseSourceAssetId(requestData, sceneAssetIds)
				if (sourceAssetId instanceof Response) {
					return sourceAssetId
				}

				const studioFinish = parseStudioFinish(requestData, [
					...sceneAssetIds,
					...(sourceAssetId ? [sourceAssetId] : [])
				])
				if (studioFinish instanceof Response) {
					return studioFinish
				}

				const thumbnailUrl = parseThumbnailUrl(
					meta.thumbnailUrl,
					sceneId,
					sceneAssetIds
				)
				if (thumbnailUrl instanceof Response) {
					return thumbnailUrl
				}

				const artworkRefusal = checkHotspotArtwork(
					settings.hotspots,
					sceneId,
					sceneAssetIds
				)
				if (artworkRefusal) {
					return artworkRefusal
				}

				return {
					action,
					requestId,
					projectId,
					sceneId,
					targetProjectId,
					targetFolderId,
					meta: { ...meta, thumbnailUrl },
					settings,
					sceneAssetIds,
					sourceAssetId,
					studioFinish,
					gltfJson: undefined,
					optimizationReport: optimizationReport || undefined,
					optimizationSettings: optimizationSettings || undefined,
					initialSceneBytes
				}
			}

			if (!sceneId && !gltfJsonData) {
				return ApiResponse.badRequest('Scene ID is required for this action')
			}

			return {
				action,
				requestId,
				projectId,
				sceneId,
				targetProjectId,
				targetFolderId,
				meta,
				settings,
				gltfJson: gltfJsonData || undefined,
				optimizationReport: optimizationReport || undefined,
				optimizationSettings: optimizationSettings || undefined,
				initialSceneBytes
			}
		} catch (error) {
			console.warn('Failed to parse scene settings request:', error)
			return ApiResponse.badRequest('Invalid request format')
		}
	}

	private static validateSceneId(
		action: string,
		sceneId?: string
	): Response | null {
		const requiresSceneId =
			action === 'get-scene-settings' ||
			action === 'commit-scene-publish' ||
			action === 'revoke-scene-publish'

		if (requiresSceneId && !sceneId) {
			return ApiResponse.badRequest('Scene ID is required')
		}

		if (sceneId && !UUID_REGEX.test(sceneId)) {
			return ApiResponse.badRequest('Scene ID must be a valid UUID format')
		}

		return null
	}
}
