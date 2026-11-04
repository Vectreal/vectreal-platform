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
 *   geometrically, so a zoom feels constant rather than rushing at the end.
 *   Where that orbit would pass through the model, the whole flight pulls
 *   back in one smooth hump, planned before the first frame (`orbitPath`).
 *   A floor applied frame by frame bent the path at the moment it touched
 *   the model and then slid the camera round the model's center, speeding up
 *   five-fold where the orbit passed closest to it.
 *
 * The lens zooms geometrically too, whatever the type: `tan(fov / 2)`, the
 * width it frames per unit of distance, moves by equal ratios in equal time.
 * The framed size the eye reads as zoom is distance times that width, so
 * Smart's is one geometric curve from end to end wherever the orbit clears
 * the model; where it pulls back, the framed size widens and narrows again
 * with it. A field of view lerped in degrees fought the geometric distance,
 * and a switch from a narrow lens to a wide one zoomed out past its
 * destination halfway and came back.
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

/**
 * Where Smart checks its clearance before it flies, and how far past the
 * floor it aims mid-flight, as a fraction of it. The floor holds exactly at
 * every check; between two checks the aim keeps the path within about half
 * a percent of it (0.43% at worst over 20,000 random flights), well inside
 * the clearance and never on the model.
 */
const CLEARANCE_SAMPLES = 64
const CLEARANCE_MARGIN = 5e-3

/**
 * The most Smart pulls back from the target, as a ratio of the orbit's
 * distance. A flight that needs more, or that the pull-back cannot clear,
 * orbits the model's center instead (`orbitPath`).
 */
const MAX_LIFT = Math.log(3)

/**
 * How close to either end the hump may peak, as a fraction of the flight.
 * It bounds how steeply the hump rises and falls: a shortfall that only a
 * sharper hump would cover needs more than `MAX_LIFT` and orbits the
 * center instead.
 */
const LIFT_PEAK_RANGE = 0.2

/**
 * The progress of check `index`, packed toward both ends: a shortfall that
 * starts at an end, as one does leaving a close-up inside the clearance,
 * grows from nothing there and would slip between evenly spaced checks.
 */
const clearanceCheck = (index: number) =>
	(1 - Math.cos((Math.PI * index) / CLEARANCE_SAMPLES)) / 2

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

const DEGREES = Math.PI / 180

/** A vertical field of view, in degrees, part-way along the lens zoom. */
function lensLerp(fromFov: number, toFov: number, t: number): number {
	const halfWidth = logLerp(
		Math.tan((fromFov * DEGREES) / 2),
		Math.tan((toFov * DEGREES) / 2),
		t
	)
	return (2 * Math.atan(halfWidth)) / DEGREES
}

/**
 * Smart's orbit around the moving target, and how it pulls back to clear the
 * model: by `lift` at most, as `log(distance / orbit distance)`, at progress
 * `liftPeak` (`liftShape`).
 */
interface OrbitPath {
	theta: number
	deltaTheta: number
	phi: number
	deltaPhi: number
	fromRadius: number
	toRadius: number
	lift: number
	liftPeak: number
	/** Orbiting the model's center rather than the target. */
	aroundCenter: boolean
}

const scratchFrom = new Spherical()
const scratchTo = new Spherical()
const scratchOffset = new Vector3()
const scratchDirection = new Vector3()
const scratchMatrix = new Matrix4()
const scratchRadii = new Float64Array(CLEARANCE_SAMPLES)
const scratchEntries = new Float64Array(CLEARANCE_SAMPLES)
const scratchExits = new Float64Array(CLEARANCE_SAMPLES)
const scratchRequired = new Float64Array(CLEARANCE_SAMPLES)
const scratchPath: OrbitPath = {
	theta: 0,
	deltaTheta: 0,
	phi: 0,
	deltaPhi: 0,
	fromRadius: 0,
	toRadius: 0,
	lift: 0,
	liftPeak: 0.5,
	aroundCenter: false
}

/** The unit direction from the target to the camera at eased progress `t`. */
function orbitDirection(path: OrbitPath, t: number, out: Vector3): Vector3 {
	return out.setFromSphericalCoords(
		1,
		path.phi + path.deltaPhi * t,
		path.theta + path.deltaTheta * t
	)
}

/**
 * The hump the lift is spread over: 0 at both ends, rising to 1 at `peak`,
 * and smooth everywhere between. It is `4u(1 - u)` with progress remapped by
 * `t / (t + k(1 - t))`, which is a half at the peak. A late peak keeps the
 * start of the flight nearly untouched, so a flight into a close-up does not
 * back away first, and an early one leaves the landing alone the same way.
 */
function liftShape(t: number, peak: number): number {
	const k = peak / (1 - peak)
	const u = t / (t + k * (1 - t))
	return 4 * u * (1 - u)
}

/** The orbit from `fromPivot` to `toPivot`, angles and distances, into `out`. */
function orbitAround(
	flight: CameraFlight,
	fromPivot: Vector3,
	toPivot: Vector3,
	out: OrbitPath
): void {
	scratchFrom.setFromVector3(
		scratchOffset.subVectors(flight.from.position, fromPivot)
	)
	scratchTo.setFromVector3(
		scratchOffset.subVectors(flight.to.position, toPivot)
	)
	out.theta = scratchFrom.theta
	out.deltaTheta = shortestAngleDelta(scratchFrom.theta, scratchTo.theta)
	out.phi = scratchFrom.phi
	out.deltaPhi = scratchTo.phi - scratchFrom.phi
	out.fromRadius = scratchFrom.radius
	out.toRadius = scratchTo.radius
}

/**
 * Smart's orbit for `flight`, written to `out`, with the smallest pull-back
 * that keeps it outside the model.
 *
 * The floor on the distance from the model's center is the clearance while
 * both ends are outside it, and the deeper end's own distance when one of
 * them is a close-up inside it: never deeper than the flight already goes,
 * and an end inside the sphere is never pushed away from. At each check, the
 * distance from the target that clears the floor along the orbit's direction
 * is where that ray leaves the floor's sphere. The hump is placed and scaled
 * to cover every check with the least lift. A flight that clears the model
 * everywhere gets no lift and flies the plain orbit.
 *
 * Where no hump within `MAX_LIFT` clears every check, as when the target
 * sits beside the model rather than in it, the flight orbits the model's
 * center instead. Its distance from the center moves geometrically between
 * the ends' own, so it never comes below the floor, and it is as smooth as
 * the orbit around the target. It gives up only the framed size's single
 * geometric curve.
 *
 * Planned whole, before any frame is placed, because the path has to start
 * bending before it reaches the model to stay smooth: a floor met frame by
 * frame can only bend it at the moment of contact.
 */
function orbitPath(flight: CameraFlight, out: OrbitPath): OrbitPath {
	const { from, to, bounds } = flight
	orbitAround(flight, from.target, to.target, out)
	out.lift = 0
	out.liftPeak = 0.5
	out.aroundCenter = false
	if (!bounds || bounds.isEmpty()) return out

	const floor = Math.min(
		bounds.radius * (1 + SMART_FLIGHT_CLEARANCE),
		from.position.distanceTo(bounds.center),
		to.position.distanceTo(bounds.center)
	)
	// Where each check's ray from the target crosses the floor's sphere.
	let short = false
	for (let i = 1; i < CLEARANCE_SAMPLES; i++) {
		const t = clearanceCheck(i)
		scratchRadii[i] = logLerp(out.fromRadius, out.toRadius, t)
		scratchEntries[i] = scratchExits[i] = scratchRequired[i] = 0
		const offset = scratchOffset
			.lerpVectors(from.target, to.target, t)
			.sub(bounds.center)
		const along = offset.dot(orbitDirection(out, t, scratchDirection))
		// Aimed past the floor mid-flight, and at it on an end sitting there.
		const reach = floor * (1 + CLEARANCE_MARGIN * 4 * t * (1 - t))
		const discriminant = along * along - offset.lengthSq() + reach * reach
		if (discriminant <= 0 || scratchRadii[i] < MIN_DISTANCE) continue
		scratchEntries[i] = -along - Math.sqrt(discriminant)
		scratchExits[i] = -along + Math.sqrt(discriminant)
		if (insideFloor(i, scratchRadii[i])) {
			scratchRequired[i] = Math.log(scratchExits[i] / scratchRadii[i])
			short = true
		}
	}
	if (!short) return out

	fitLift(out)
	if (out.lift <= MAX_LIFT && !anyCheckInside(out)) return out

	orbitAround(flight, bounds.center, bounds.center, out)
	out.lift = 0
	out.aroundCenter = true
	return out
}

/**
 * Whether check `i`, at distance `radius` from its target, is inside the
 * floor. A hump fitted to land on a check's exit comes back within a
 * rounding error of it, which is on the floor, not inside it.
 */
function insideFloor(i: number, radius: number): boolean {
	return (
		radius > scratchEntries[i] * (1 + 1e-9) &&
		radius < scratchExits[i] * (1 - 1e-9)
	)
}

/** Whether the lift leaves any check inside the floor, or carries one into it. */
function anyCheckInside(path: OrbitPath): boolean {
	for (let i = 1; i < CLEARANCE_SAMPLES; i++) {
		const lifted =
			scratchRadii[i] *
			Math.exp(path.lift * liftShape(clearanceCheck(i), path.liftPeak))
		if (insideFloor(i, lifted)) return true
	}
	return false
}

/** The hump that reaches every check's required ratio with the least lift. */
function fitLift(path: OrbitPath): void {
	path.lift = Infinity
	for (let p = 1; p < CLEARANCE_SAMPLES; p++) {
		const peak = clearanceCheck(p)
		// A peak nearer an end than this falls to nothing in a frame or two.
		if (peak < LIFT_PEAK_RANGE || peak > 1 - LIFT_PEAK_RANGE) continue
		let lift = 0
		for (let i = 1; i < CLEARANCE_SAMPLES && lift < path.lift; i++) {
			if (scratchRequired[i] === 0) continue
			lift = Math.max(
				lift,
				scratchRequired[i] / liftShape(clearanceCheck(i), peak)
			)
		}
		if (lift < path.lift) {
			path.lift = lift
			path.liftPeak = peak
		}
	}
}

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
	const path = orbitPath(flight, scratchPath)
	const radius =
		logLerp(path.fromRadius, path.toRadius, t) *
		Math.exp(path.lift * liftShape(t, path.liftPeak))
	return orbitDirection(path, t, out)
		.multiplyScalar(radius)
		.add(path.aroundCenter ? flight.bounds!.center : target)
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

	// The ends are copied: the lens's round trip through tan and atan is off
	// by a rounding error, and a camera at rest must show its stored lens.
	if (t <= 0) {
		out.position.copy(from.position)
		out.fov = from.fov
	} else if (t >= 1) {
		out.position.copy(to.position)
		out.fov = to.fov
	} else {
		out.fov = lensLerp(from.fov, to.fov, t)
		if (flight.type === 'object_avoidance') {
			sampleOrbitPosition(flight, t, out.target, out.position)
		} else {
			out.position.lerpVectors(from.position, to.position, t)
		}
	}

	// A camera looks down its -z axis; Matrix4.lookAt with eye first matches
	// what Object3D.lookAt does for cameras.
	out.quaternion.setFromRotationMatrix(
		scratchMatrix.lookAt(out.position, out.target, up)
	)
	return out
}
