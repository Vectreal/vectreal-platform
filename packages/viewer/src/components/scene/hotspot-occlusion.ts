/**
 * How often the occlusion pass runs, in seconds.
 *
 * Not every frame. Each test is a recursive raycast over the whole model, and
 * there is no BVH in this stack, so per-frame testing multiplies a full triangle
 * traversal by the number of hotspots for the entire duration of any orbit. At
 * 15Hz the marker's own 300ms opacity transition still covers the step, and the
 * pass keeps running while the camera is still, which a camera-motion trigger
 * does not: an animated model can swing in front of a hotspot with nobody
 * touching the controls.
 */
export const OCCLUSION_INTERVAL_SECONDS = 1 / 15

/**
 * Fraction of the camera-to-hotspot distance ignored at the far end of the ray.
 */
const OCCLUSION_TOLERANCE_RATIO = 0.005

/** Floor for the tolerance, for a hotspot almost touching the camera. */
const MIN_OCCLUSION_TOLERANCE = 1e-4

/**
 * How far along the camera-to-hotspot ray a hit still counts as occluding.
 *
 * The tolerance is the whole point. A hotspot is authored by raycasting the
 * model and storing the intersection verbatim, so it lies *exactly* on a
 * triangle. Testing the full distance means the nearest hit is that same
 * triangle at the same distance, and the comparison then turns on float noise:
 * a marker sitting in plain view flickers between drawn and faded, and while it
 * reads as faded its linked camera cannot be reached at all.
 *
 * Relative rather than absolute so it holds across model scales. The viewer
 * normalizes a model's diagonal into [0.5, 5], and a fixed epsilon that suits
 * the top of that range swallows thin geometry at the bottom of it.
 *
 * Returns 0 when nothing can occlude - the hotspot is at or inside the
 * tolerance - which callers read as "do not bother casting". The final clamp is
 * what produces that for a zero or negative distance, so there is no separate
 * guard for it.
 */
export function occlusionRayFar(distance: number): number {
	if (!Number.isFinite(distance)) return 0

	const tolerance = Math.max(
		distance * OCCLUSION_TOLERANCE_RATIO,
		MIN_OCCLUSION_TOLERANCE
	)

	return Math.max(distance - tolerance, 0)
}
