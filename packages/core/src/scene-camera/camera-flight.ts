import { Matrix4, Quaternion, Spherical, Vector3 } from 'three'

import type { CameraTransitionEasing, CameraTransitionType } from '../types'
import type { Sphere } from 'three'

/**
 * The flight between two cameras, as pure functions of raw progress.
 *
 * Kept free of React and of the scene so a frame can be computed anywhere: the
 * viewer samples it once per rendered frame, and an offline render can sample
 * it at any frame rate and get the same path.
 *
 * Three rules shape it.
 *
 * - **Sampled continuously.** The pose is a function of progress alone. The
 *   flight it replaced snapped progress to a fixed number of steps, so at 60 fps
 *   the position held still on two frames of three and jumped on the third.
 * - **Aimed at the moving target.** Orientation is derived from position and
 *   target, the way `OrbitControls.update()` derives it, so the subject stays
 *   where the path puts it rather than sliding across the frame.
 * - **Smart flies in orbit space.** It interpolates the target linearly, the
 *   azimuth the short way round, the polar angle linearly and the distance
 *   geometrically, so a zoom feels constant rather than rushing at the end. The
 *   model's bounding sphere is a floor on the distance from its center, never
 *   a reason to swing wide: the path only bends away where it would otherwise
 *   pass through the model.
 */

export interface CameraFlightPose {
	position: Vector3
	target: Vector3
	fov: number
}

export interface CameraFlight {
	type: Exclude<CameraTransitionType, 'none'>
	from: CameraFlightPose
	to: CameraFlightPose
	easing?: CameraTransitionEasing
	/** The model's world bounding sphere. Only Smart reads it. */
	bounds?: Sphere | null
}

export interface CameraFlightFrame extends CameraFlightPose {
	/** The camera's orientation: looking at `target`, upright on `up`. */
	quaternion: Quaternion
}

/**
 * How far outside the model's bounding sphere Smart keeps the camera, as a
 * fraction of the sphere's radius. Scales with the model, so a small model and
 * a large one fly the same shape.
 */
export const SMART_FLIGHT_CLEARANCE = 0.1

/** Where the distance floor eases in and out, as a fraction of the floor. */
const FLOOR_BLEND = 0.25

const MIN_DISTANCE = 1e-6

const DEFAULT_UP = new Vector3(0, 1, 0)

/**
 * Progress after easing. Every curve starts at 0, ends at 1, and never runs
 * backwards. `ease_in_out` is smootherstep: its acceleration is continuous
 * and zero at both ends, where the quadratic in-out it replaced jumped from
 * full acceleration to full deceleration at the midpoint.
 */
export function easeFlightProgress(
	t: number,
	easing?: CameraTransitionEasing
): number {
	const x = Math.min(1, Math.max(0, t))
	switch (easing) {
		case 'ease_in':
			return x * x * x
		case 'ease_out':
			return 1 - Math.pow(1 - x, 3)
		case 'ease_in_out':
			return x * x * x * (x * (x * 6 - 15) + 10)
		case 'linear':
		default:
			return x
	}
}

/** `a + (b - a)` taken the short way round the circle. */
function shortestAngleDelta(a: number, b: number): number {
	const delta = (b - a) % (Math.PI * 2)
	if (delta > Math.PI) return delta - Math.PI * 2
	if (delta <= -Math.PI) return delta + Math.PI * 2
	return delta
}

/**
 * Geometric interpolation: equal ratios in equal time. A zero end has no
 * ratio, so it falls back to a straight lerp rather than idling at the zero
 * end and rushing at the other.
 */
function logLerp(a: number, b: number, t: number): number {
	if (a < MIN_DISTANCE || b < MIN_DISTANCE) return a + (b - a) * t
	return a * Math.pow(b / a, t)
}

/**
 * The larger of `a` and `b`, rounded off over a band `k` wide so the switch
 * from one to the other carries no velocity jump. `k` of 0 is a plain max.
 */
function smoothMax(a: number, b: number, k: number): number {
	if (k <= 0) return Math.max(a, b)
	const h = Math.max(k - Math.abs(a - b), 0) / k
	return Math.max(a, b) + (h * h * k) / 4
}

const scratchFrom = new Spherical()
const scratchTo = new Spherical()
const scratchOffset = new Vector3()
const scratchMatrix = new Matrix4()

/**
 * Smart's position at eased progress `t`, written to `out`. `target` is the
 * target at the same progress.
 */
function sampleOrbitPosition(
	flight: CameraFlight,
	t: number,
	target: Vector3,
	out: Vector3
): Vector3 {
	const { from, to, bounds } = flight
	scratchFrom.setFromVector3(
		scratchOffset.subVectors(from.position, from.target)
	)
	scratchTo.setFromVector3(scratchOffset.subVectors(to.position, to.target))

	const theta =
		scratchFrom.theta +
		shortestAngleDelta(scratchFrom.theta, scratchTo.theta) * t
	const phi = scratchFrom.phi + (scratchTo.phi - scratchFrom.phi) * t
	const radius = logLerp(scratchFrom.radius, scratchTo.radius, t)
	out.setFromSphericalCoords(radius, phi, theta).add(target)

	if (!bounds || bounds.isEmpty() || t <= 0 || t >= 1) return out

	/*
	  The floor on the distance from the model's center: outside the sphere
	  while both ends are, and no deeper than the ends interpolate to when one
	  of them is a close-up inside it. An end inside the sphere is never pushed
	  away from, so the endpoints stay exact.
	*/
	const clear = bounds.radius * (1 + SMART_FLIGHT_CLEARANCE)
	const floor = Math.min(
		clear,
		logLerp(
			from.position.distanceTo(bounds.center),
			to.position.distanceTo(bounds.center),
			t
		)
	)
	const offset = scratchOffset.subVectors(out, bounds.center)
	const distance = offset.length()
	// Rounded off mid-flight only; at the ends the band closes to a plain max.
	const blend = floor * FLOOR_BLEND * 4 * t * (1 - t)
	const clamped = smoothMax(distance, floor, blend)
	if (clamped === distance) return out
	if (distance < MIN_DISTANCE) {
		// Dead center: push out along the start's side.
		offset.subVectors(from.position, bounds.center)
		if (offset.lengthSq() < MIN_DISTANCE) offset.set(0, 0, 1)
	}
	return out.copy(bounds.center).add(offset.setLength(clamped))
}

/**
 * The camera's pose at raw progress `rawProgress` (0 to 1, linear in time).
 * Reuses `out` when given one, so a per-frame caller allocates nothing.
 */
export function sampleCameraFlight(
	flight: CameraFlight,
	rawProgress: number,
	out: CameraFlightFrame = {
		position: new Vector3(),
		target: new Vector3(),
		fov: 0,
		quaternion: new Quaternion()
	},
	up: Vector3 = DEFAULT_UP
): CameraFlightFrame {
	const { from, to } = flight
	const t = easeFlightProgress(rawProgress, flight.easing)

	out.target.lerpVectors(from.target, to.target, t)
	out.fov = from.fov + (to.fov - from.fov) * t

	if (t <= 0) {
		out.position.copy(from.position)
	} else if (t >= 1) {
		out.position.copy(to.position)
	} else if (flight.type === 'object_avoidance') {
		sampleOrbitPosition(flight, t, out.target, out.position)
	} else {
		out.position.lerpVectors(from.position, to.position, t)
	}

	// A camera looks down its -z axis; Matrix4.lookAt with eye first matches
	// what Object3D.lookAt does for cameras.
	out.quaternion.setFromRotationMatrix(
		scratchMatrix.lookAt(out.position, out.target, up)
	)
	return out
}
