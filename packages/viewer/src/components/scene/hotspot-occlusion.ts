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
 * Fraction of the model's bounding-box diagonal ignored at the far end of the
 * ray.
 */
const OCCLUSION_TOLERANCE_RATIO = 0.005

/** Floor for the tolerance, for a degenerately small model. */
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
 * Relative rather than absolute so it holds across model scales: a fixed epsilon
 * that suits a 5-unit model swallows thin geometry on a 0.5-unit one.
 *
 * Relative to the *smaller* of the model's diagonal and the camera distance,
 * because the two references fail at opposite ends. Camera distance alone is
 * unbounded above - nothing bounds the dolly, so zooming out widened the slack
 * until markers behind real geometry stopped dimming. The model's diagonal alone
 * is unbounded relative to the view: normalization is off by default, so a
 * 200-unit model is ordinary, and 0.5% of it is a whole world unit that would
 * swallow a railing standing in front of the marker the moment the author
 * orbits in to look at it. Taking the smaller keeps each one honest where the
 * other is not.
 *
 * Returns 0 when nothing can occlude - the hotspot is at or behind the camera,
 * or so close to it that nothing could fit in between - which callers read as
 * "do not bother casting".
 */
export function occlusionRayFar(
	distance: number,
	modelDiagonal: number
): number {
	if (!Number.isFinite(distance)) return 0
	// Nothing fits between the camera and a marker this close, so skip the cast
	// rather than let the distance cap below hand back a ray of a few hundred
	// nanometres for every such marker on every pass.
	if (distance <= MIN_OCCLUSION_TOLERANCE) return 0

	// Whichever reference is smaller. The model bounds the far dolly, where a
	// camera-relative slack grew without limit until markers behind real geometry
	// stopped dimming. The distance bounds the near case, where a large model's
	// slack would otherwise swallow a genuine occluder a few units in front of
	// the marker - and normalization is off by default, so a 200-unit model is
	// the ordinary case rather than an extreme one.
	const reference =
		Number.isFinite(modelDiagonal) && modelDiagonal > 0
			? Math.min(modelDiagonal, distance)
			: distance

	const tolerance = Math.max(
		reference * OCCLUSION_TOLERANCE_RATIO,
		MIN_OCCLUSION_TOLERANCE
	)

	return Math.max(distance - tolerance, 0)
}
