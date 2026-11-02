import type { Vector3 } from 'three'

/**
 * Keeping a camera's framed subject in view on any viewport.
 *
 * A camera's `fov` is vertical, so the height it frames holds on any viewport
 * and the width follows the viewport's aspect. Shown narrower than it was
 * framed (a phone, a slim embed), the sides of the subject fell outside the
 * frame.
 *
 * The rule is contain, by dolly: on a narrower viewport the camera backs off
 * its target until the width it framed fits again, and on a wider one it stays
 * where it was stored. Backing off keeps the stored lens; widening the fov
 * instead would have turned a 60 degree desktop camera into a 120 degree one on
 * a phone held upright.
 *
 * Perspective cameras only: a stored camera is a `PerspectiveCameraProps`, and
 * an orthographic view has no distance to back off along.
 */

/**
 * The aspect a camera saved before `framingAspect` was recorded is taken to
 * have been framed at. 16:9 errs toward showing the whole subject: a camera
 * actually framed narrower is backed off a little more than it needs.
 */
export const LEGACY_FRAMING_ASPECT = 16 / 9

/**
 * The farthest a camera backs off, as a multiple of its stored distance. A very
 * tall, narrow embed would otherwise push the subject down to a speck.
 */
export const MAX_FRAMING_SCALE = 4

/**
 * Whether `value` can be a camera's `framingAspect`: a finite, positive
 * width-over-height ratio. Stored settings arrive as JSON from saved scenes and
 * host pages, so anything else is treated as absent.
 */
export const isFramingAspect = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0

/** The aspect a camera was framed at, or the legacy one when it has none. */
export function resolveFramingAspect(value: unknown): number {
	return isFramingAspect(value) ? value : LEGACY_FRAMING_ASPECT
}

/**
 * How far a camera framed at `framingAspect` backs off its target on a viewport
 * of `viewportAspect`, as a multiple of its stored distance.
 *
 * A viewport with no area yet (a canvas measured before layout) has no aspect
 * to fit to, and keeps the stored distance.
 */
export function framingScale(
	framingAspect: number,
	viewportAspect: number
): number {
	if (!Number.isFinite(viewportAspect) || viewportAspect <= 0) return 1
	return Math.min(
		MAX_FRAMING_SCALE,
		Math.max(1, framingAspect / viewportAspect)
	)
}

/** A pose's fit: the aspect it was framed at, and the scale applied for the viewport. */
export interface ViewportFraming {
	aspect: number
	scale: number
}

/** Scales `position`'s distance from `target` by `factor`, in place. */
export function scaleOrbitOffset(
	position: Vector3,
	target: Vector3,
	factor: number
): Vector3 {
	return position.sub(target).multiplyScalar(factor).add(target)
}

/**
 * Refits a pose for a viewport of `viewportAspect`, in place: its distance from
 * `target` moves by the change in fit, and `framing.scale` records the new one.
 *
 * Relative to the fit already applied, so a visitor's own orbit and zoom carry
 * over, and successive refits compose to the same pose as one. Returns whether
 * the pose moved.
 */
export function refitToViewport(
	position: Vector3,
	target: Vector3,
	framing: ViewportFraming,
	viewportAspect: number
): boolean {
	const scale = framingScale(framing.aspect, viewportAspect)
	if (scale === framing.scale) return false
	scaleOrbitOffset(position, target, scale / framing.scale)
	framing.scale = scale
	return true
}

/** The distance limits a host set on the orbit controls, before any fit. */
export interface OrbitDistanceLimits {
	minDistance?: number
	maxDistance?: number
}

/**
 * The host's distance limits scaled with the fit.
 *
 * Orbit controls clamp the distance on every update, so a fit past a host's
 * `maxDistance` would be undone at once and the subject cropped again. Scaling
 * both limits by the same factor keeps the visitor's zoom range in proportion
 * to the framing: zooming in on a phone stops where it stops on a desktop,
 * relative to the subject. A flight passes the scales of both of its ends, so
 * neither end is clamped while it plays.
 */
export function scaleOrbitDistanceLimits(
	limits: OrbitDistanceLimits,
	lowScale: number,
	highScale = lowScale
): { minDistance: number; maxDistance: number } {
	return {
		minDistance: (limits.minDistance ?? 0) * lowScale,
		maxDistance: (limits.maxDistance ?? Infinity) * highScale
	}
}

/** A pose as the refit moves it: a position and the target it orbits. */
export interface OrbitPose {
	position: Vector3
	target: Vector3
}

/** A fit framed at `viewportAspect` itself, which no narrowing has moved yet. */
const framedAt = (viewportAspect: number): ViewportFraming => ({
	aspect: viewportAspect,
	scale: 1
})

/**
 * Which fit the view on screen carries, and the two ends of a flight in
 * progress: the bookkeeping a live camera needs to refit whatever it is
 * showing when the viewport changes shape.
 *
 * Framework-free, so the rules are tested here; the viewer's camera layer
 * calls it where it shows a pose, starts and lands a flight, and resizes.
 */
export class CameraFraming {
	/** The fit of the pose on screen, or of a flight's start while one plays. */
	view: ViewportFraming
	/** The fit of the flight's destination while one plays. */
	destination: ViewportFraming | null = null
	/** The live viewport's aspect, as last given. */
	private viewportAspect: number

	/**
	 * A view nothing has fitted yet (the live camera's own pose, or a bounds
	 * fit made for this viewport) counts as framed at the live aspect. Taking
	 * it as the legacy aspect instead read a pose-less opening view on a phone
	 * as unfitted by a factor of 3, and the first resize of any size, even the
	 * browser's address bar collapsing, applied the whole jump at once.
	 */
	constructor(viewportAspect: number) {
		this.viewportAspect = viewportAspect
		this.view = framedAt(viewportAspect)
	}

	/** Starts over: see the constructor. */
	reset(viewportAspect: number): void {
		this.viewportAspect = viewportAspect
		this.view = framedAt(viewportAspect)
		this.destination = null
	}

	/**
	 * A pose shown at once. `null` is a pose read off the live camera, which
	 * keeps the fit already in view: part-way through a flight it replaces,
	 * the blend at `progress`, as for `fly`.
	 */
	show(framing: ViewportFraming | null, progress: number | null = null): void {
		this.view = framing ?? this.blendAt(progress)
		this.destination = null
	}

	/**
	 * A flight from the live pose to one with `framing` (`null` keeps the fit in
	 * view, as for `show`).
	 *
	 * When it replaces a flight still playing, the live pose lies part-way
	 * between that flight's ends, so its fit is the blend at `progress`, the
	 * interrupted flight's eased progress (see `blendAt`). Keeping the
	 * interrupted flight's start fit instead dropped the destination's from the
	 * distance limits, and the new flight's first frames clamped inward.
	 */
	fly(framing: ViewportFraming | null, progress: number | null = null): void {
		const from = this.blendAt(progress)
		this.view = from
		// A copy when there is no fit of its own: the two ends must not share
		// one object, or a refit would scale it once for both.
		this.destination = framing ?? { ...from }
	}

	/** The flight reached its destination, which is now the view. */
	land(): void {
		if (!this.destination) return
		this.view = this.destination
		this.destination = null
	}

	/**
	 * Refits for a viewport of `viewportAspect`, in place: the view, or both
	 * ends of a flight when `flight` is given. Returns whether anything moved.
	 */
	refit(
		viewportAspect: number,
		view: OrbitPose | null,
		flight: { from: OrbitPose; to: OrbitPose } | null = null
	): boolean {
		this.viewportAspect = viewportAspect
		if (flight && this.destination) {
			const from = refitToViewport(
				flight.from.position,
				flight.from.target,
				this.view,
				viewportAspect
			)
			const to = refitToViewport(
				flight.to.position,
				flight.to.target,
				this.destination,
				viewportAspect
			)
			return from || to
		}
		return view
			? refitToViewport(view.position, view.target, this.view, viewportAspect)
			: false
	}

	/**
	 * The pose on screen as a camera stores it: without the fit, and framed at
	 * the width the screen shows, `scale` times the live aspect. Shown again
	 * anywhere, it frames that width.
	 *
	 * Storing the fitted pose with the live aspect made a phone's backed-off
	 * view the camera's framing, and a desktop then showed the subject at a
	 * quarter of its size. Storing the camera's own aspect instead lost the
	 * width an author framed on a viewport wider than it, where the fit sits at
	 * scale 1, and narrower viewports then cropped it.
	 *
	 * `progress` is the eased progress of a flight in progress, whose pose sits
	 * between its two ends' fits.
	 */
	storedPose(
		position: Vector3,
		target: Vector3,
		viewportAspect: number,
		progress: number | null = null
	): { position: Vector3; framingAspect: number } {
		const { scale } = this.blendAt(progress)
		return {
			position: scaleOrbitOffset(position.clone(), target, 1 / scale),
			framingAspect: scale * viewportAspect
		}
	}

	/**
	 * The fit of the live pose: the view's, or part-way through a flight at
	 * `progress`, the two ends' scales blended linearly, framed at the width
	 * that shows on the live viewport.
	 *
	 * The aspect follows from the scale, so `framingScale(aspect, live)` gives
	 * the scale back and the next refit starts from the pose as it is. Blending
	 * the two ends' aspects as well disagreed with the scale whenever an end
	 * was clamped (a camera framed narrower than the viewport sits at 1), and a
	 * resize of half a percent then moved the camera by a fifth. At a scale of
	 * 1 both ends are unfitted, so any aspect up to the live one is consistent,
	 * and the blend of theirs keeps the cameras' own.
	 *
	 * Linear, because no flight puts the camera farther out than that: a
	 * straight flight lerps the position, whose offset from the target is then
	 * no longer than the lerp of the two ends' offsets, and a smart flight lerps
	 * the radius geometrically, which is shorter still. A geometric blend sat
	 * below a straight flight's distance, and the scaled `maxDistance` clamped
	 * the camera inward when the flight was interrupted.
	 */
	private blendAt(progress: number | null): ViewportFraming {
		if (!this.destination || progress === null) return this.view
		const t = Math.min(1, Math.max(0, progress))
		const blend = (from: number, to: number) => from + (to - from) * t
		const scale = blend(this.view.scale, this.destination.scale)
		return {
			aspect:
				scale > 1
					? scale * this.viewportAspect
					: blend(this.view.aspect, this.destination.aspect),
			scale
		}
	}

	/** The host's limits scaled for the view, or spanning both ends of a flight. */
	distanceLimits(limits: OrbitDistanceLimits): {
		minDistance: number
		maxDistance: number
	} {
		const from = this.view.scale
		const to = this.destination?.scale ?? from
		return scaleOrbitDistanceLimits(
			limits,
			Math.min(from, to),
			Math.max(from, to)
		)
	}
}
