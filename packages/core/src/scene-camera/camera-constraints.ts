import { Quaternion, Spherical, Vector3 } from 'three'

import type { CameraConstraints, ControlsProps } from '../types/scene-types'
import type { OrbitLimits } from './orbit-limits'

const RADIANS = Math.PI / 180

/** The scene-wide controls a camera without limits of its own is held to. */
export type LegacyCameraControls = Pick<
	ControlsProps,
	| 'enableZoom'
	| 'enablePan'
	| 'enableRotate'
	| 'minDistance'
	| 'maxDistance'
	| 'minPolarAngle'
	| 'maxPolarAngle'
	| 'minAzimuthAngle'
	| 'maxAzimuthAngle'
>

/**
 * A camera's limits as the orbit controls take them, before they meet a pose:
 * a relative limit needs the camera's own distance or azimuth
 * (`orbitLimitsFor`). Angles in radians.
 */
export interface ResolvedCameraConstraints {
	zoom: boolean
	pan: boolean
	rotate: boolean
	distance:
		| { relative: true; closer: number; farther: number }
		| { relative: false; min: number; max: number }
	/** Measured from straight up, as the controls measure it. */
	polar: { min: number; max: number }
	azimuth:
		| { relative: true; left: number; right: number }
		| { relative: false; min: number; max: number }
}

/**
 * The limits that hold a visitor at a camera.
 *
 * A camera with `constraints` owns all of its limits, and a kind it leaves out
 * is not limited. A camera without them is held to the scene-wide controls, so
 * every scene saved before cameras had limits behaves exactly as it did. The
 * caller passes those controls merged with its own defaults: the viewer's
 * default vertical limit is the viewer's to own. `enableRotate` has no
 * per-camera setting and always comes from the scene.
 */
export function resolveCameraConstraints(
	constraints: CameraConstraints | undefined,
	legacy: LegacyCameraControls
): ResolvedCameraConstraints {
	const rotate = legacy.enableRotate !== false
	if (!constraints) {
		return {
			zoom: legacy.enableZoom !== false,
			pan: legacy.enablePan !== false,
			rotate,
			distance: {
				relative: false,
				min: legacy.minDistance ?? 0,
				max: legacy.maxDistance ?? Infinity
			},
			polar: {
				min: legacy.minPolarAngle ?? 0,
				max: legacy.maxPolarAngle ?? Math.PI
			},
			azimuth: {
				relative: false,
				min: legacy.minAzimuthAngle ?? -Infinity,
				max: legacy.maxAzimuthAngle ?? Infinity
			}
		}
	}

	const { zoom, pan, tilt, orbit } = constraints
	return {
		zoom: zoom?.enabled !== false,
		pan: pan !== false,
		rotate,
		distance: {
			relative: true,
			closer: zoom?.closer ?? Infinity,
			farther: zoom?.farther ?? Infinity
		},
		// The highest elevation is the smallest angle from straight up.
		polar: {
			min: (90 - (tilt?.highest ?? 90)) * RADIANS,
			max: (90 - (tilt?.lowest ?? -90)) * RADIANS
		},
		azimuth: orbit
			? {
					relative: true,
					left: orbit.left * RADIANS,
					right: orbit.right * RADIANS
				}
			: { relative: false, min: -Infinity, max: Infinity }
	}
}

/** Where a camera sits around the point it orbits. */
export interface OrbitAnchor {
	distance: number
	/** Radians around the vertical axis; 0 looks from +Z, and its right is +. */
	azimuth: number
	/** Degrees above the horizon. */
	elevation: number
}

/** The camera's place around its target, measured as the controls measure it. */
export function orbitAnchor(
	position: Vector3,
	target: Vector3,
	up: Vector3 = new Vector3(0, 1, 0)
): OrbitAnchor {
	const toYUp = new Quaternion().setFromUnitVectors(up, new Vector3(0, 1, 0))
	const spherical = new Spherical().setFromVector3(
		position.clone().sub(target).applyQuaternion(toYUp)
	)
	return {
		distance: spherical.radius,
		azimuth: spherical.theta,
		elevation: 90 - spherical.phi / RADIANS
	}
}

/**
 * The orbit limits a camera's resolved limits come to around its own view.
 * The distances are the stored view's: the viewer scales them with the fit on
 * screen, as it scales every distance limit (`scaleOrbitDistanceLimits`).
 */
export function orbitLimitsFor(
	resolved: ResolvedCameraConstraints,
	anchor: Pick<OrbitAnchor, 'distance' | 'azimuth'>
): OrbitLimits {
	const { distance, azimuth, polar } = resolved
	const turnsAllRound =
		azimuth.relative && azimuth.left + azimuth.right >= 2 * Math.PI
	return {
		minPolarAngle: polar.min,
		maxPolarAngle: polar.max,
		minAzimuthAngle: !azimuth.relative
			? azimuth.min
			: turnsAllRound
				? -Infinity
				: anchor.azimuth - azimuth.left,
		maxAzimuthAngle: !azimuth.relative
			? azimuth.max
			: turnsAllRound
				? Infinity
				: anchor.azimuth + azimuth.right,
		minDistance: distance.relative
			? anchor.distance / distance.closer
			: distance.min,
		maxDistance: distance.relative
			? anchor.distance * distance.farther
			: distance.max
	}
}

/** How far a new camera lets a visitor zoom, either way. */
export const DEFAULT_ZOOM_FACTOR = 2
/** The highest a new camera lets a visitor look from: short of straight down. */
export const DEFAULT_HIGHEST_TILT = 85

/**
 * The limits a camera gets when nothing else gives it any: zoom either way by
 * `DEFAULT_ZOOM_FACTOR`, pan, all the way round, and from level up to
 * `DEFAULT_HIGHEST_TILT`. The tilt range widens to take in the camera's own
 * elevation, so the view it was saved at is always one a visitor can reach.
 */
export function defaultCameraConstraints(elevation: number): CameraConstraints {
	return {
		zoom: {
			enabled: true,
			closer: DEFAULT_ZOOM_FACTOR,
			farther: DEFAULT_ZOOM_FACTOR
		},
		pan: true,
		tilt: {
			lowest: Math.min(0, elevation),
			highest: Math.max(DEFAULT_HIGHEST_TILT, elevation)
		}
	}
}
