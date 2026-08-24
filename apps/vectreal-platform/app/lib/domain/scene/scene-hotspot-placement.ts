/**
 * What a hotspot may be anchored to, and what counts as asking to anchor it.
 *
 * Both rules used to live inline in the editor's pointer handler, phrased as
 * subtraction: every `Mesh` in the scene except the one carrying
 * `userData.editorOverlay`. Nothing but the hotspot's own anchor ever carried
 * that tag, so the set silently grew to include drei's `TransformControls`
 * plane - an invisible `PlaneGeometry(1e5, 1e5)` parked on the gizmo and turned
 * to face the camera - along with every shadow catcher the viewer mounts. The
 * nearest hit was normally one of those, and the hotspot ended up on a point
 * that lines up with the model only from the camera it was placed from.
 *
 * Phrasing it as an allowlist over the rendered model is what removes the
 * cause: nothing anyone adds to the scene later can join the set by omission.
 *
 * This sits in the flat `domain/scene` tier with the rest of the
 * `scene-hotspot-*` family rather than in `client/`, even though the settings
 * parser will never share it. `three` is imported for types only, so the module
 * stays runtime-dependency-free and runs under the node test environment like
 * its siblings.
 */

import type { Object3D, Raycaster } from 'three'

/**
 * How far the pointer may travel between press and release and still count as
 * a placement rather than an orbit.
 *
 * OrbitControls shares the canvas, so a press that turns into a drag is a
 * camera move; without a threshold the first frame of every orbit re-placed the
 * armed hotspot. It has a floor as well as a ceiling: a real click jitters by a
 * pixel or two, and at zero almost none of them would register.
 */
export const HOTSPOT_PLACEMENT_DRAG_TOLERANCE_PX = 4

/**
 * How far in front of a marker geometry has to be before it counts as covering
 * it.
 *
 * A ray hits triangles rather than the ideal surface, so an anchor resolved by
 * `resolveHotspotAnchor` comes back a faceting error *inside* the model. Without
 * the slack every marker would read as occluded by the very face it was placed
 * on.
 */
export const HOTSPOT_OCCLUSION_TOLERANCE = 0.05

export interface HotspotPlacementGesture {
	/** `PointerEvent.button`: 0 is the primary button. */
	button: number
	downX: number
	downY: number
	upX: number
	upY: number
	/**
	 * Whether the press landed on a `TransformControls` handle.
	 *
	 * The gizmo and the armed placement tool are always on screen together, and
	 * three-stdlib stops neither propagation nor the event. A nudge of an arrow
	 * shorter than the drag tolerance therefore reads as a click, and the anchor
	 * it resolves is under the arrow tip - tens of pixels from the hotspot the
	 * author was adjusting.
	 */
	grabbedGizmo: boolean
}

/**
 * Whether a press-and-release was a click asking to place, rather than a camera
 * drag, a gizmo nudge, or a secondary-button gesture that happens to start over
 * the canvas.
 */
export function isHotspotPlacementGesture(
	gesture: HotspotPlacementGesture,
	tolerancePx: number = HOTSPOT_PLACEMENT_DRAG_TOLERANCE_PX
): boolean {
	if (gesture.button !== 0) return false
	if (gesture.grabbedGizmo) return false

	return (
		Math.hypot(gesture.upX - gesture.downX, gesture.upY - gesture.downY) <=
		tolerancePx
	)
}

/**
 * Prepares a raycaster for hotspot work.
 *
 * `Raycaster` defaults `Points.threshold` and `Line.threshold` to 1, meaning a
 * ray passing within a *world unit* of a point or line primitive counts as a
 * hit. The filter this module replaced took `Mesh` and nothing else, so on a
 * glTF carrying `POINTS` or `LINES` - scan and CAD exports do - recursing the
 * model subtree would otherwise anchor hotspots to stray points floating a unit
 * off the surface.
 */
export function prepareHotspotRaycaster<T extends Raycaster>(raycaster: T): T {
	raycaster.params.Points.threshold = 0
	raycaster.params.Line.threshold = 0

	return raycaster
}

/**
 * The world-space point a pointer lands on, or `null` when it missed the model.
 *
 * `modelRoot` must be the object the viewer mounts, not an ancestor of it.
 * Widening it to the scene root puts the gizmo plane and the shadow catchers
 * back in the set, which is the whole defect: the viewer mounts both as
 * siblings of the model's `<Center>` wrapper, not inside it.
 *
 * Missing returns nothing rather than falling back to whatever else the ray
 * crossed: a click on the background is not a placement, and answering it with
 * a point in mid-air is how hotspots ended up floating beside the model.
 */
export function resolveHotspotAnchor(
	raycaster: Raycaster,
	modelRoot: Object3D | null
): [number, number, number] | null {
	if (!modelRoot) return null

	const hit = raycaster.intersectObject(modelRoot, true)[0]
	if (!hit) return null

	// `point` is world space, which is what a hotspot stores. The model hangs
	// under the viewer's <Center> offset and its normalization scale group, so
	// reading anything local would land the marker at an unscaled, un-offset
	// position.
	return [hit.point.x, hit.point.y, hit.point.z]
}

/**
 * Whether the model stands between `origin` and a marker `distance` away.
 *
 * Reads the same subtree as `resolveHotspotAnchor` so the two cannot disagree
 * about what counts as geometry: while this walked the whole scene, the gizmo's
 * 100,000-unit plane covered every marker from every angle and dimmed them all.
 */
export function isHotspotOccluded(
	raycaster: Raycaster,
	modelRoot: Object3D | null,
	distance: number,
	tolerance: number = HOTSPOT_OCCLUSION_TOLERANCE
): boolean {
	if (!modelRoot) return false

	const hit = raycaster.intersectObject(modelRoot, true)[0]

	return !!hit && hit.distance < distance - tolerance
}
