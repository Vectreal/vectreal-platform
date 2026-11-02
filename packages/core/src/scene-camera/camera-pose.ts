import { Euler, Vector3, type Vector3Tuple } from 'three'

import { DEFAULT_CAMERA, isSceneCamera } from './camera-settings'
import { withOpeningPose } from './opening-pose'

import type { OpeningPose } from './opening-pose'
import type { CameraProps } from '../types'

/**
 * Where a stored camera puts the view.
 *
 * A stored camera may say less than a full pose: a position without a target,
 * a rotation without a position, or nothing but a field of view. The missing
 * parts are completed from the live camera, so a partial camera means "move
 * only what I say". Pure, so the viewer flies to it, a capture renders from it
 * and anything without a canvas can ask where a camera stands.
 */

/** The live camera a partial stored camera is completed from. */
export interface LiveCameraState {
	position: Vector3
	/** The orbit target the live camera looks at. */
	target: Vector3
	fov: number
}

export interface ResolvedCameraPose {
	/** The camera the pose belongs to, after the fallbacks below. */
	cameraId: string
	position: Vector3
	rotation: Euler
	target: Vector3
	fov: number
}

function hasSerializableVector3(value: unknown): boolean {
	return (
		(Array.isArray(value) && value.length >= 3) ||
		value instanceof Vector3 ||
		(typeof value === 'object' &&
			value !== null &&
			'x' in value &&
			'y' in value &&
			'z' in value)
	)
}

function toVector3(value: unknown, fallback = new Vector3(0, 0, 0)): Vector3 {
	if (Array.isArray(value) && value.length >= 3) {
		const [x, y, z] = value as Vector3Tuple
		return new Vector3(Number(x) || 0, Number(y) || 0, Number(z) || 0)
	}

	if (
		typeof value === 'object' &&
		value !== null &&
		'x' in value &&
		'y' in value &&
		'z' in value
	) {
		const vectorLike = value as { x: unknown; y: unknown; z: unknown }
		return new Vector3(
			Number(vectorLike.x) || 0,
			Number(vectorLike.y) || 0,
			Number(vectorLike.z) || 0
		)
	}

	if (value instanceof Vector3) {
		return value.clone()
	}

	return fallback.clone()
}

function toEuler(value: unknown): Euler {
	if (Array.isArray(value) && value.length >= 3) {
		const [x, y, z] = value as Vector3Tuple
		return new Euler(Number(x) || 0, Number(y) || 0, Number(z) || 0)
	}

	if (
		typeof value === 'object' &&
		value !== null &&
		'x' in value &&
		'y' in value &&
		'z' in value
	) {
		const eulerLike = value as { x: unknown; y: unknown; z: unknown }
		return new Euler(
			Number(eulerLike.x) || 0,
			Number(eulerLike.y) || 0,
			Number(eulerLike.z) || 0
		)
	}

	if (value instanceof Euler) {
		return value.clone()
	}

	if (value instanceof Vector3) {
		return new Euler(value.x, value.y, value.z)
	}

	return new Euler(0, 0, 0)
}

/**
 * The pose `cameraId` resolves to.
 *
 * The camera is the one asked for, else the scene's initial camera, else its
 * first scene camera, else its first camera, else `DEFAULT_CAMERA`. A camera
 * with no pose of its own stands at `openingPose` when it is the one the scene
 * opened on (`withOpeningPose`).
 */
export function resolveCameraPose(
	cameras: CameraProps['cameras'],
	cameraId: string | undefined,
	live: LiveCameraState,
	openingPose: OpeningPose | null = null
): ResolvedCameraPose {
	const sceneCameras = cameras?.filter(isSceneCamera)
	const defaultCamera =
		sceneCameras && sceneCameras.length > 0 ? sceneCameras[0] : cameras?.[0]

	const foundCamera =
		cameras?.find((camera) => camera.cameraId === cameraId) ??
		cameras?.find((camera) => camera.initial) ??
		defaultCamera ??
		cameras?.[0] ??
		DEFAULT_CAMERA
	const selectedCamera = withOpeningPose(foundCamera, openingPose)

	// `lookAt` is the legacy name for `target`, still found in older scenes.
	const storedTarget: unknown =
		selectedCamera.target ?? (selectedCamera as { lookAt?: unknown }).lookAt
	const rawTargetLookAt = toVector3(storedTarget, live.target)
	const rawRotation = toEuler(selectedCamera.rotation)
	const hasPosition = hasSerializableVector3(selectedCamera.position)
	const hasTarget = hasSerializableVector3(storedTarget)
	const hasRotation = hasSerializableVector3(selectedCamera.rotation)
	const fallbackOrbitRadius = Math.max(live.position.distanceTo(live.target), 1)
	const forward = new Vector3(0, 0, -1).applyEuler(rawRotation).normalize()

	const position = hasPosition
		? toVector3(selectedCamera.position, live.position)
		: hasRotation
			? rawTargetLookAt
					.clone()
					.sub(forward.clone().multiplyScalar(fallbackOrbitRadius))
			: live.position.clone()

	const target = hasTarget
		? rawTargetLookAt
		: hasPosition && hasRotation
			? position
					.clone()
					.add(forward.clone().multiplyScalar(fallbackOrbitRadius))
			: rawTargetLookAt

	return {
		cameraId: selectedCamera.cameraId ?? 'default',
		position,
		rotation: rawRotation,
		target,
		fov: typeof selectedCamera.fov === 'number' ? selectedCamera.fov : live.fov
	}
}
