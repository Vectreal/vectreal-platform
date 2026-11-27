import {
	orbitAnchor,
	resolveHotspotCameraTargets
} from '@vctrl/core/scene-camera'
import { Vector3 } from 'three'

import type {
	CameraConfig,
	CameraConstraints,
	ControlsProps,
	HotspotDefinition
} from '@vctrl/core'

const DEGREES = 180 / Math.PI

/** The scene-wide controls a camera without limits of its own follows. */
export type SceneLimitControls = Pick<
	ControlsProps,
	'enableZoom' | 'enablePan' | 'minPolarAngle' | 'maxPolarAngle'
>

const clampTilt = (degrees: number) => Math.max(-90, Math.min(90, degrees))

/** The furthest zoom factor a slider sets; its end means no limit. */
export const ZOOM_FACTOR_MAX = 10

const isTuple = (value: unknown): value is [number, number, number] =>
	Array.isArray(value) && value.length === 3

/**
 * The camera's elevation above the horizon, in degrees, from its saved pose
 * and what the viewer aims it at: its target (`lookAt` in older scenes), or a
 * hotspot camera saved without one at its hotspot (`hotspots`, as
 * `resolveHotspotCameraTargets` aims it). Level for a camera with no pose.
 */
export function cameraElevation(
	camera: CameraConfig,
	hotspots?: readonly HotspotDefinition[]
): number {
	const [aimed = camera] = resolveHotspotCameraTargets([camera], hotspots) ?? []
	const { position } = aimed
	if (!isTuple(position)) return 0
	const stored: unknown = aimed.target ?? (aimed as { lookAt?: unknown }).lookAt
	const aim = isTuple(stored) ? stored : [0, 0, 0]
	return orbitAnchor(
		new Vector3(...(position as [number, number, number])),
		new Vector3(...(aim as [number, number, number]))
	).elevation
}

/**
 * What a camera's limits are now: its own, or what the scene-wide controls
 * give a camera without them. That is what the Limits view shows and what its
 * first edit writes, so nothing a visitor gets changes until the author
 * changes it. A scene-wide distance or orbit limit has never had a setting,
 * so only zoom, pan and tilt carry over.
 */
export function cameraLimits(
	camera: CameraConfig,
	scene: SceneLimitControls
): CameraConstraints {
	if (camera.constraints) return camera.constraints
	// Rounded outward, so no angle a visitor can reach now is taken away, and
	// held to what a save accepts, whatever an older save stored.
	const lowest = clampTilt(
		Math.floor(90 - (scene.maxPolarAngle ?? Math.PI / 2) * DEGREES)
	)
	const highest = clampTilt(
		Math.ceil(90 - (scene.minPolarAngle ?? 0) * DEGREES)
	)
	return {
		zoom: { enabled: scene.enableZoom !== false },
		pan: scene.enablePan !== false,
		tilt: { lowest: Math.min(lowest, highest), highest }
	}
}

/**
 * The limits with the tilt range widened to take in `elevation`, so the view
 * a camera is saved at is always one a visitor can reach. Limits without a
 * tilt range are returned as they are.
 */
export function withElevationInTilt(
	constraints: CameraConstraints,
	elevation: number
): CameraConstraints {
	const { tilt } = constraints
	if (!tilt) return constraints
	const lowest =
		tilt.lowest === undefined
			? undefined
			: Math.min(tilt.lowest, Math.floor(elevation))
	const highest =
		tilt.highest === undefined
			? undefined
			: Math.max(tilt.highest, Math.ceil(elevation))
	if (lowest === tilt.lowest && highest === tilt.highest) return constraints
	return { ...constraints, tilt: { lowest, highest } }
}

/** A short line for the Limits row: what a visitor can do from this camera. */
export function describeCameraLimits(limits: CameraConstraints): string {
	const parts: string[] = []
	parts.push(limits.zoom?.enabled === false ? 'No zoom' : 'Zoom')
	parts.push(limits.pan === false ? 'no pan' : 'pan')
	if (limits.orbit) parts.push(`${limits.orbit.left}° / ${limits.orbit.right}°`)
	return parts.join(', ')
}
