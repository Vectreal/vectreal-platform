import { Box3, Ray, Vector3 } from 'three'

/**
 * How far outside the model the camera stays, as a share of the model's
 * diagonal: clear of the surface, so the near plane never cuts into it.
 */
export const CAMERA_GUARD_MARGIN = 0.02

const guarded = new Box3()
const size = new Vector3()
const ray = new Ray()
const hit = new Vector3()

/** `bounds` grown by the margin, into `target`. */
export function guardBox(bounds: Box3, target = new Box3()): Box3 {
	if (bounds.isEmpty()) return target.makeEmpty()
	const margin = bounds.getSize(size).length() * CAMERA_GUARD_MARGIN
	return target.copy(bounds).expandByScalar(margin)
}

/**
 * Whether a camera moving from `from` to `to` ends inside the model (`bounds`
 * grown by the margin) or passes through it on the way: a large zoom step can
 * cross a thin model (a painting, a tabletop) without ever stopping inside it.
 *
 * The viewer answers a move that does by putting the camera back where it was,
 * so zooming stops at the surface and an orbit at the model's edge, the view
 * never swings off its line and never comes out the far side. A box, not the
 * mesh: it also keeps the camera out of a deep recess (an open car door), where
 * the near plane could still cut the surface. A camera the author saved inside
 * the box is not guarded at all (`isInsideGuard`).
 */
export function entersModel(from: Vector3, to: Vector3, bounds: Box3): boolean {
	guardBox(bounds, guarded)
	if (guarded.isEmpty()) return false
	// A pose already in the margin (a close-up saved near the surface) is
	// judged against the model itself, so it can still move.
	const box = guarded.containsPoint(from) ? bounds : guarded
	if (box.containsPoint(to)) return true
	const length = from.distanceTo(to)
	if (length === 0) return false
	ray.origin.copy(from)
	ray.direction.copy(to).sub(from).divideScalar(length)
	const entry = ray.intersectBox(box, hit)
	return entry !== null && entry.distanceTo(from) <= length
}

/** Whether a stored camera stands inside the model, where the guard stays off. */
export function isInsideGuard(position: Vector3, bounds: Box3): boolean {
	return !bounds.isEmpty() && bounds.containsPoint(position)
}
