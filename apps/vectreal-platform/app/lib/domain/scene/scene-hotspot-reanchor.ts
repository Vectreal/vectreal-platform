import { placeHotspot } from './scene-hotspot-camera-links'

import type { CameraHotspotState } from './scene-hotspot-camera-links'

/**
 * Moves hotspots to follow a change in the model's normalization scale.
 *
 * A hotspot stores a world-space point captured after the viewer's `<Center>`
 * offset and its normalization scale (`resolveHotspotAnchor`). Neither is
 * persisted: both are re-derived from the model's bounding box on every load.
 * So changing normalization rescales the model while the markers stay put, and
 * they visibly detach from the surface they were placed on.
 *
 * The correction is a plain multiply, and it is worth recording both why and
 * what that rests on, because the `<Center>` offset looks like it should have to
 * be accounted for and does not - but only because the viewer makes sure of it.
 *
 * The viewer's model transform is `M = T(c) . S`, where `S` is the normalization
 * scale and `c` is the centering offset. `c` is computed from the *scaled*
 * bounding box and centering is linear in that box, so `c = S . c0` for a fixed
 * `c0`. For a point `p` placed under `S`, the point under `S'` is
 *
 *     M' . M^-1 . p
 *       = S' . (S^-1 . p - c0) + S' . c0
 *       = (S' / S) . p
 *
 * The offsets cancel exactly. So this needs the two scales and nothing else -
 * no bounding box, no knowledge of drei's centering rule, and no server-side
 * transform that could not be computed anyway.
 *
 * The load-bearing premise is `c = S . c0`, and it is not free: drei's `Center`
 * measures in a layout effect that does not depend on its children, so it
 * re-measures only because the viewer passes a `cacheKey` derived from the same
 * normalization scale. Without that key `c` is frozen at its mount value, the
 * offsets stop cancelling, and the correct mapping becomes
 * `ratio . (p - c) + c`. This multiply would then move every marker on a model
 * not authored at the origin further from the geometry than leaving it alone.
 * `center-cache-key-wiring.spec.ts` guards the key for exactly this reason.
 *
 * Each move goes through `placeHotspot` rather than writing `worldPosition`
 * directly, so a hotspot's own camera keeps looking at it. That camera carries
 * an explicit world-space `target` written at placement time; scaling the marker
 * without scaling the target would leave every hotspot camera aimed at where its
 * marker used to be, which type-checks and breaks no other test.
 *
 * Only the scale is corrected here. A camera the author framed by hand, and the
 * shadow light, are also world-space and also stale after a rescale - filed
 * separately, because they are not the hotspot subsystem and fixing them here
 * would put two concerns in one change.
 */
export function reanchorHotspotsForScale(
	state: CameraHotspotState,
	previousScale: number,
	nextScale: number
): CameraHotspotState {
	if (
		!Number.isFinite(previousScale) ||
		!Number.isFinite(nextScale) ||
		previousScale <= 0 ||
		nextScale <= 0
	) {
		return state
	}

	const ratio = nextScale / previousScale
	// Returned by identity when nothing moves, so a caller can keep memoizing on
	// it and an unrelated settings write does not mark the scene dirty.
	if (ratio === 1) return state

	return state.hotspots.reduce<CameraHotspotState>((current, hotspot) => {
		const [x, y, z] = hotspot.worldPosition
		return placeHotspot(current, hotspot.id, [x * ratio, y * ratio, z * ratio])
	}, state)
}
