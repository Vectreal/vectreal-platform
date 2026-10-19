import { ApiResponse } from '@shared/utils'
import { normalizeCameraSettings } from '@vctrl/core'

import {
	applyDefaultCameraFlag,
	resolveDefaultSceneCameraId
} from '../scene-camera'

import type { CameraProps, CameraTransitionConfig } from '@vctrl/core'

export type CameraEntry = NonNullable<CameraProps['cameras']>[number]

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCameraSettings(
	camera?: CameraProps
): CameraProps | undefined | Response {
	if (!camera) {
		return camera
	}

	if (!Array.isArray(camera.cameras) || camera.cameras.length === 0) {
		return ApiResponse.badRequest('camera.cameras must be a non-empty array')
	}

	// Validate scene-global transition if provided. It is stored as sent.
	if (camera.sceneTransition !== undefined) {
		const transitionRefusal = validateTransitionConfig(
			camera.sceneTransition,
			'camera.sceneTransition'
		)
		if (transitionRefusal) {
			return transitionRefusal
		}
	}

	// The viewer hides its switcher only for a literal `false`, so anything
	// else that is not a boolean would read as "shown" and drop the setting.
	if (
		camera.showControls !== undefined &&
		typeof camera.showControls !== 'boolean'
	) {
		return ApiResponse.badRequest('camera.showControls must be a boolean')
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
			return ApiResponse.badRequest(`Duplicate cameraId found: ${rawCameraId}`)
		}
		seenCameraIds.add(rawCameraId)

		normalizedCameras.push({
			...(entry as CameraEntry),
			cameraId: rawCameraId,
			name: rawCameraName
		})
	}

	const defaultSceneCameraId = resolveDefaultSceneCameraId(normalizedCameras)

	if (!defaultSceneCameraId) {
		return ApiResponse.badRequest(
			'camera.cameras must contain at least one scene camera'
		)
	}

	const normalizedWithDefault = {
		...camera,
		// Always use first scene camera as the active camera
		activeCameraId: defaultSceneCameraId,
		cameras: applyDefaultCameraFlag(normalizedCameras)
	}

	// Apply canonical normalization (which will re-enforce the implicit default)
	return normalizeCameraSettings(normalizedWithDefault)
}

/**
 * Refuses a transition the viewer cannot play, and accepts anything else as
 * sent.
 *
 * A validator, not a normalizer. It used to build a copy with object-avoidance
 * defaults filled in, and its caller only ever checked that copy for a refusal
 * and stored the original. The viewer owns those defaults where it plays the
 * transition, so filling them in here would only have created a second owner.
 */
function validateTransitionConfig(
	transition: CameraTransitionConfig | undefined,
	path: string
): Response | null {
	if (!transition) {
		return null
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
			(typeof samples !== 'number' || !Number.isFinite(samples) || samples < 2)
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
	}

	return null
}
