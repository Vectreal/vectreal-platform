import { JSONDocument } from '@gltf-transform/core'
import { ApiResponse } from '@shared/utils'
import {
	normalizeCameraSettings,
	normalizeSceneInteractions,
	OptimizationReport,
	Optimizations
} from '@vctrl/core'

import { UUID_REGEX } from '../../../../constants/utility-constants'
import { parseActionRequest } from '../../../http/requests.server'

import type { SceneSettingsRequest } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type {
	CameraProps,
	CameraTransitionConfig,
	SceneSettings
} from '@vctrl/core'

type CameraEntry = NonNullable<CameraProps['cameras']>[number]

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Request parser for scene settings API operations.
 * Handles validation and normalization of incoming requests.
 */
export class SceneSettingsParser {
	/**
	 * Parses and validates scene settings request data.
	 * @param request - The HTTP request to parse
	 * @returns Parsed request data or error response
	 */
	static async parseSceneSettingsRequest(
		request: Request
	): Promise<SceneSettingsRequest | Response> {
		try {
			const requestData = await parseActionRequest(request)
			return this.parseSceneSettingsRequestData(requestData)
		} catch (error) {
			console.error('Failed to parse scene settings request:', error)
			return ApiResponse.badRequest('Invalid request format')
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
			const projectId = this.parseProjectId(requestData)
			if (projectId instanceof Response) {
				return projectId
			}
			const targetProjectId = this.parseTargetProjectId(requestData)
			if (targetProjectId instanceof Response) {
				return targetProjectId
			}
			const targetFolderId = this.parseTargetFolderId(requestData)
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
				const publishedAssetId = this.parsePublishedAssetId(requestData)
				if (publishedAssetId instanceof Response) {
					return publishedAssetId
				}
				const currentSceneBytes = this.parseCurrentSceneBytes(requestData)
				if (currentSceneBytes instanceof Response) {
					return currentSceneBytes
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
					publishedAssetId,
					currentSceneBytes
				}
			}

			if (action === 'save-scene-settings') {
				return ApiResponse.badRequest(
					'save-scene-settings is no longer supported. Use upload-scene-asset/upload-scene-gltf + commit-scene-save.'
				)
			}

			// Parse settings data (required for save operations)
			const settings = this.parseSettingsData(requestData)
			if (settings instanceof Response) {
				return settings
			}

			const gltfJsonData = this.parseGltfJson(requestData)
			if (gltfJsonData instanceof Response) {
				return gltfJsonData
			}

			const optimizationReport = this.parseOptimizationReport(requestData)
			if (optimizationReport instanceof Response) {
				return optimizationReport
			}

			const optimizationSettings = this.parseOptimizationSettings(requestData)
			if (optimizationSettings instanceof Response) {
				return optimizationSettings
			}

			const initialSceneBytes = this.parseInitialSceneBytes(requestData)
			if (initialSceneBytes instanceof Response) {
				return initialSceneBytes
			}

			const currentSceneBytes = this.parseCurrentSceneBytes(requestData)
			if (currentSceneBytes instanceof Response) {
				return currentSceneBytes
			}

			const meta = this.parseSceneMeta(requestData)
			if (meta instanceof Response) {
				return meta
			}

			if (action === 'commit-scene-save') {
				const sceneAssetIds = this.parseSceneAssetIds(requestData)
				if (sceneAssetIds instanceof Response) {
					return sceneAssetIds
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
					sceneAssetIds,
					gltfJson: undefined,
					optimizationReport: optimizationReport || undefined,
					optimizationSettings: optimizationSettings || undefined,
					initialSceneBytes,
					currentSceneBytes
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
				initialSceneBytes,
				currentSceneBytes
			}
		} catch (error) {
			console.error('Failed to parse scene settings request:', error)
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

	/**
	 * Parses settings data from request.
	 */
	private static parseSettingsData(
		requestData: Record<string, unknown>
	): SceneSettings | Response {
		let settings: Record<string, unknown> | undefined

		// Try 'settings' field first (current implementation)
		if (requestData.settings) {
			if (typeof requestData.settings === 'string') {
				try {
					settings = JSON.parse(requestData.settings)
				} catch (error) {
					console.error('Failed to parse settings:', error)
					return ApiResponse.badRequest('Invalid settings data format')
				}
			} else if (
				typeof requestData.settings === 'object' &&
				requestData.settings !== null
			) {
				settings = requestData.settings as Record<string, unknown>
			}
		}

		// Fallback to 'settingsData' field
		if (!settings && requestData.settingsData) {
			if (typeof requestData.settingsData === 'string') {
				try {
					settings = JSON.parse(requestData.settingsData)
				} catch (error) {
					console.error('Failed to parse settingsData:', error)
					return ApiResponse.badRequest('Invalid settings data format')
				}
			} else if (
				typeof requestData.settingsData === 'object' &&
				requestData.settingsData !== null
			) {
				settings = requestData.settingsData as Record<string, unknown>
			}
		}

		// Validate that we have a valid settings object
		if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
			console.error('Invalid settings format:', settings)
			return ApiResponse.badRequest('Settings must be a valid object')
		}

		const sceneSettings = settings as SceneSettings
		const normalizedCamera = this.normalizeCameraSettings(sceneSettings.camera)
		if (normalizedCamera instanceof Response) {
			return normalizedCamera
		}

		let normalizedInteractions: SceneSettings['interactions']
		try {
			normalizedInteractions = normalizeSceneInteractions(
				sceneSettings.interactions,
				{ camera: normalizedCamera }
			)
		} catch (error) {
			return ApiResponse.badRequest(
				error instanceof Error
					? error.message
					: 'Invalid scene interactions configuration'
			)
		}

		const normalizedHotspots = this.normalizeHotspots(
			sceneSettings.hotspots,
			normalizedCamera?.cameras ?? []
		)
		if (normalizedHotspots instanceof Response) {
			return normalizedHotspots
		}

		return {
			...sceneSettings,
			camera: normalizedCamera,
			interactions: normalizedInteractions,
			hotspots: normalizedHotspots
		}
	}

	private static normalizeCameraSettings(
		camera?: CameraProps
	): CameraProps | undefined | Response {
		if (!camera) {
			return camera
		}

		if (!Array.isArray(camera.cameras) || camera.cameras.length === 0) {
			return ApiResponse.badRequest('camera.cameras must be a non-empty array')
		}

		// Validate scene-global transition if provided.
		if (camera.sceneTransition !== undefined) {
			const normalizedTransition = this.normalizeTransitionConfig(
				camera.sceneTransition,
				'camera.sceneTransition'
			)
			if (normalizedTransition instanceof Response) {
				return normalizedTransition
			}
		}

		const normalizedCameras: CameraEntry[] = []
		const seenCameraIds = new Set<string>()

		for (const [cameraIndex, entry] of camera.cameras.entries()) {
			if (!isRecord(entry)) {
				return ApiResponse.badRequest('Each camera must be a valid object')
			}

			const rawCameraId =
				typeof entry.cameraId === 'string' && entry.cameraId.trim()
					? entry.cameraId.trim()
					: `camera-${cameraIndex + 1}`
			const rawCameraName =
				typeof entry.name === 'string' && entry.name.trim()
					? entry.name.trim()
					: `Camera ${cameraIndex + 1}`

			if (seenCameraIds.has(rawCameraId)) {
				return ApiResponse.badRequest(
					`Duplicate cameraId found: ${rawCameraId}`
				)
			}
			seenCameraIds.add(rawCameraId)

			normalizedCameras.push({
				...(entry as CameraEntry),
				cameraId: rawCameraId,
				name: rawCameraName
			})
		}

		// Find the first scene camera (non-hotspot)
		const firstSceneCameraId = normalizedCameras.find(
			(entry) => !entry.kind || entry.kind === 'scene'
		)?.cameraId

		if (!firstSceneCameraId) {
			return ApiResponse.badRequest(
				'camera.cameras must contain at least one scene camera'
			)
		}

		// Enforce implicit first-camera default:
		// - activeCameraId always points to first scene camera
		// - initial flag is set on first scene camera only
		const normalizedWithDefault = {
			...camera,
			// Always use first scene camera as the active camera
			activeCameraId: firstSceneCameraId,
			cameras: normalizedCameras.map((cameraEntry) => ({
				...cameraEntry,
				initial: cameraEntry.cameraId === firstSceneCameraId
			}))
		}

		// Apply canonical normalization (which will re-enforce the implicit default)
		return normalizeCameraSettings(normalizedWithDefault)
	}

	/**
	 * Validates and passes through hotspot definitions.
	 */
	private static normalizeHotspots(
		hotspots: SceneSettings['hotspots'],
		cameras: CameraEntry[]
	): SceneSettings['hotspots'] | Response {
		if (!hotspots) return hotspots
		if (!Array.isArray(hotspots)) {
			return ApiResponse.badRequest('hotspots must be an array')
		}

		const VALID_STYLE_PRESETS = new Set(['dot', 'image'])
		const cameraIds = new Set(cameras.map((c) => c.cameraId))
		const seenSequenceIndices = new Set<number>()

		for (const [i, hotspot] of hotspots.entries()) {
			if (!isRecord(hotspot)) {
				return ApiResponse.badRequest(`hotspots[${i}] must be a valid object`)
			}
			if (typeof hotspot.id !== 'string' || !hotspot.id.trim()) {
				return ApiResponse.badRequest(`hotspots[${i}].id is required`)
			}
			if (typeof hotspot.name !== 'string' || !hotspot.name.trim()) {
				return ApiResponse.badRequest(`hotspots[${i}].name is required`)
			}
			if (
				!Array.isArray(hotspot.worldPosition) ||
				hotspot.worldPosition.length !== 3 ||
				!(hotspot.worldPosition as unknown[]).every(
					(v) => typeof v === 'number'
				)
			) {
				return ApiResponse.badRequest(
					`hotspots[${i}].worldPosition must be [number, number, number]`
				)
			}
			if (typeof hotspot.visible !== 'boolean') {
				return ApiResponse.badRequest(
					`hotspots[${i}].visible must be a boolean`
				)
			}
			if (typeof hotspot.internalOnly !== 'boolean') {
				return ApiResponse.badRequest(
					`hotspots[${i}].internalOnly must be a boolean`
				)
			}
			if (!VALID_STYLE_PRESETS.has(hotspot.stylePreset as string)) {
				return ApiResponse.badRequest(
					`hotspots[${i}].stylePreset must be 'dot' or 'image'`
				)
			}
			if (
				hotspot.linkedCameraId !== undefined &&
				hotspot.linkedCameraId !== null
			) {
				if (typeof hotspot.linkedCameraId !== 'string') {
					return ApiResponse.badRequest(
						`hotspots[${i}].linkedCameraId must be a string`
					)
				}
				if (!cameraIds.has(hotspot.linkedCameraId)) {
					return ApiResponse.badRequest(
						`hotspots[${i}].linkedCameraId references unknown camera '${hotspot.linkedCameraId}'`
					)
				}
			}
			if (
				hotspot.sequenceIndex !== undefined &&
				hotspot.sequenceIndex !== null
			) {
				if (
					typeof hotspot.sequenceIndex !== 'number' ||
					!Number.isInteger(hotspot.sequenceIndex) ||
					hotspot.sequenceIndex < 0
				) {
					return ApiResponse.badRequest(
						`hotspots[${i}].sequenceIndex must be a non-negative integer`
					)
				}
				if (seenSequenceIndices.has(hotspot.sequenceIndex)) {
					return ApiResponse.badRequest(
						`hotspots has duplicate sequenceIndex ${hotspot.sequenceIndex}`
					)
				}
				seenSequenceIndices.add(hotspot.sequenceIndex)
			}
		}

		return hotspots
	}

	private static normalizeTransitionConfig(
		transition: CameraTransitionConfig | undefined,
		path: string
	): CameraTransitionConfig | Response | undefined {
		if (!transition) {
			return undefined
		}

		if (!isRecord(transition)) {
			return ApiResponse.badRequest(`${path} must be an object`)
		}

		const type = transition.type
		if (type !== 'linear' && type !== 'object_avoidance' && type !== 'none') {
			return ApiResponse.badRequest(
				`${path}.type must be one of linear, object_avoidance, none`
			)
		}

		if (typeof transition.duration !== 'undefined') {
			if (
				typeof transition.duration !== 'number' ||
				!Number.isFinite(transition.duration) ||
				transition.duration < 0
			) {
				return ApiResponse.badRequest(
					`${path}.duration must be a non-negative number`
				)
			}
		}

		if (
			typeof transition.easing !== 'undefined' &&
			transition.easing !== 'linear' &&
			transition.easing !== 'ease_in' &&
			transition.easing !== 'ease_out' &&
			transition.easing !== 'ease_in_out'
		) {
			return ApiResponse.badRequest(
				`${path}.easing must be one of linear, ease_in, ease_out, ease_in_out`
			)
		}

		if (type === 'object_avoidance') {
			if (
				typeof transition.objectAvoidance !== 'undefined' &&
				!isRecord(transition.objectAvoidance)
			) {
				return ApiResponse.badRequest(
					`${path}.objectAvoidance must be an object when provided`
				)
			}

			const objectAvoidance = isRecord(transition.objectAvoidance)
				? transition.objectAvoidance
				: {}

			const clearance = objectAvoidance.clearance
			const arcHeight = objectAvoidance.arcHeight
			const samples = objectAvoidance.samples
			const tension = objectAvoidance.tension

			if (
				typeof clearance !== 'undefined' &&
				(typeof clearance !== 'number' || !Number.isFinite(clearance))
			) {
				return ApiResponse.badRequest(
					`${path}.objectAvoidance.clearance must be a number`
				)
			}

			if (
				typeof arcHeight !== 'undefined' &&
				(typeof arcHeight !== 'number' || !Number.isFinite(arcHeight))
			) {
				return ApiResponse.badRequest(
					`${path}.objectAvoidance.arcHeight must be a number`
				)
			}

			if (
				typeof samples !== 'undefined' &&
				(typeof samples !== 'number' ||
					!Number.isFinite(samples) ||
					samples < 2)
			) {
				return ApiResponse.badRequest(
					`${path}.objectAvoidance.samples must be a number >= 2`
				)
			}

			if (
				typeof tension !== 'undefined' &&
				(typeof tension !== 'number' || !Number.isFinite(tension))
			) {
				return ApiResponse.badRequest(
					`${path}.objectAvoidance.tension must be a number`
				)
			}

			return {
				...transition,
				type,
				objectAvoidance: {
					clearance: typeof clearance === 'number' ? clearance : 2,
					arcHeight: typeof arcHeight === 'number' ? arcHeight : 2,
					samples: typeof samples === 'number' ? samples : 24,
					tension: typeof tension === 'number' ? tension : 0.5
				}
			}
		}

		return transition
	}

	/**
	 * Parses GLTF JSON from request.
	 */
	private static parseGltfJson(
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
					console.error('Failed to parse gltfJson:', error)
					return ApiResponse.badRequest('Invalid gltfJson format')
				}
			}
		}

		// Return undefined if no gltfJson provided (it's optional for some operations)
		return gltf || undefined
	}

	private static parseSceneMeta(
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
				console.error('Failed to parse scene meta:', error)
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
	 * Parses optimization report from request.
	 */
	private static parseOptimizationReport(
		requestData: Record<string, unknown>
	): OptimizationReport | undefined | Response {
		if (!requestData.optimizationReport) {
			return undefined
		}

		if (typeof requestData.optimizationReport === 'string') {
			try {
				const parsed = JSON.parse(requestData.optimizationReport)
				if (typeof parsed !== 'object' || parsed === null) {
					return ApiResponse.badRequest('Invalid optimization report format')
				}
				return parsed
			} catch (error) {
				console.error('Failed to parse optimizationReport:', error)
				return ApiResponse.badRequest('Invalid optimization report format')
			}
		}

		if (typeof requestData.optimizationReport === 'object') {
			return requestData.optimizationReport as OptimizationReport
		}

		return undefined
	}

	private static parseOptimizationSettings(
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
				console.error('Failed to parse optimizationSettings:', error)
				return ApiResponse.badRequest('Invalid optimization settings format')
			}
		}

		if (typeof requestData.optimizationSettings === 'object') {
			return requestData.optimizationSettings as Optimizations
		}

		return undefined
	}

	private static parseSceneAssetIds(
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
				return ApiResponse.badRequest(
					'sceneAssetIds must be a valid JSON array'
				)
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

	private static parsePublishedAssetId(
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

	private static parseCurrentSceneBytes(
		requestData: Record<string, unknown>
	): number | undefined | Response {
		const rawCurrentSceneBytes =
			requestData.currentSceneBytes ?? requestData.publishedBytes

		if (rawCurrentSceneBytes == null) {
			return undefined
		}

		const parsedValue =
			typeof rawCurrentSceneBytes === 'number'
				? rawCurrentSceneBytes
				: typeof rawCurrentSceneBytes === 'string'
					? Number(rawCurrentSceneBytes)
					: NaN

		if (!Number.isFinite(parsedValue) || parsedValue < 0) {
			return ApiResponse.badRequest(
				'currentSceneBytes must be a non-negative number'
			)
		}

		return Math.round(parsedValue)
	}

	private static parseInitialSceneBytes(
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

	private static parseTargetProjectId(
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

	private static parseProjectId(
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

	private static parseTargetFolderId(
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
}
