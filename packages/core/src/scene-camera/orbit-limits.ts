import { Quaternion, Spherical, Vector3 } from 'three'

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

const TWO_PI = 2 * Math.PI

/**
 * The position orbit controls would settle `position` at around `target`:
 * the azimuth, polar and distance clamps of three-stdlib's
 * `OrbitControls.update`, which the live viewer runs on every pose it shows.
 */
export function clampToOrbitLimits(
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
