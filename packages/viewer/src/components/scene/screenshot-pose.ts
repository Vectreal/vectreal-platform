import { Quaternion, Spherical, Vector3 } from 'three'

import type { Euler, PerspectiveCamera } from 'three'

/**
 * The limits orbit controls hold a camera to, read off the live controls.
 */
export type OrbitLimits = {
	minPolarAngle: number
	maxPolarAngle: number
	minAzimuthAngle: number
	maxAzimuthAngle: number
	minDistance: number
	maxDistance: number
}

/**
 * Where a screenshot looks from. `lookAt` aims the camera at a point, as orbit
 * controls do every frame, and `limits` holds it to the controls' range;
 * without `lookAt` the camera keeps `rotation`.
 */
export type CapturePose = {
	position: Vector3
	fov: number
} & ({ lookAt: Vector3; limits?: OrbitLimits } | { rotation: Euler })

const TWO_PI = 2 * Math.PI

/**
 * The position orbit controls would settle `position` at around `target`:
 * the azimuth, polar and distance clamps of three-stdlib's
 * `OrbitControls.update`, which the live viewer runs on every pose it shows.
 */
function clampToOrbitLimits(
	position: Vector3,
	target: Vector3,
	up: Vector3,
	limits: OrbitLimits
): Vector3 {
	const toYUp = new Quaternion().setFromUnitVectors(up, new Vector3(0, 1, 0))
	const offset = position.clone().sub(target).applyQuaternion(toYUp)
	const spherical = new Spherical().setFromVector3(offset)

	let min = limits.minAzimuthAngle
	let max = limits.maxAzimuthAngle
	if (isFinite(min) && isFinite(max)) {
		if (min < -Math.PI) min += TWO_PI
		else if (min > Math.PI) min -= TWO_PI
		if (max < -Math.PI) max += TWO_PI
		else if (max > Math.PI) max -= TWO_PI
		spherical.theta =
			min <= max
				? Math.max(min, Math.min(max, spherical.theta))
				: spherical.theta > (min + max) / 2
					? Math.max(min, spherical.theta)
					: Math.min(max, spherical.theta)
	}

	spherical.phi = Math.max(
		limits.minPolarAngle,
		Math.min(limits.maxPolarAngle, spherical.phi)
	)
	spherical.makeSafe()
	spherical.radius = Math.max(
		limits.minDistance,
		Math.min(limits.maxDistance, spherical.radius)
	)

	return offset
		.setFromSpherical(spherical)
		.applyQuaternion(toYUp.invert())
		.add(target)
}

/**
 * A camera of the capture's own, posed for one screenshot.
 *
 * The live camera has owners: a running camera transition writes position,
 * rotation, fov and the controls target on every frame, and orbit controls
 * write it on every update. A capture that posed the live camera had to fight
 * them for the frames it waits, and had to put back afterwards a pose it read
 * at its start. When a transition ended during those frames, that pose was a
 * sample from mid-flight and nothing moved the camera off it again.
 *
 * Rendering through a clone leaves the live camera to its owners. The clone
 * keeps the live camera's aspect, zoom, view offset and clip planes; the
 * caller fits the clip planes to the new pose.
 */
export function buildCaptureCamera(
	live: PerspectiveCamera,
	pose: CapturePose
): PerspectiveCamera {
	const capture = live.clone()
	if ('lookAt' in pose) {
		capture.position.copy(
			pose.limits
				? clampToOrbitLimits(
						pose.position,
						pose.lookAt,
						capture.up,
						pose.limits
					)
				: pose.position
		)
		capture.lookAt(pose.lookAt)
	} else {
		capture.position.copy(pose.position)
		capture.rotation.copy(pose.rotation)
	}
	capture.fov = pose.fov
	capture.updateProjectionMatrix()
	capture.updateMatrixWorld()
	return capture
}
