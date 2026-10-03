import type { CameraConfig } from '@vctrl/core'

/**
 * The way back out of a hotspot's camera.
 *
 * A marker with a linked camera flies the view there, and until this existed
 * nothing knew where the visitor had been before: an embed with no chrome left
 * them standing at the hotspot with no control that led anywhere else.
 *
 * Pure, and in `.ts`, so the rule is covered by this package's runner; the
 * component that draws the control only asks it.
 */

/** A drawn marker or a stored hotspot: all the rule reads is the link. */
type Linked = { linkedCameraId?: null | string }
type ReturnCamera = Pick<CameraConfig, 'cameraId' | 'initial' | 'kind'>

/**
 * Whether a camera is a hotspot's own close-up rather than a view of the scene.
 *
 * The tag decides when there is one. A marker can be linked to any camera,
 * the scene's opening view included, and linking a scene camera does not make
 * it a hotspot's. Paired cameras saved before the publisher started tagging
 * carry no `kind`, so for those the link is the best evidence there is, and
 * it is read against every hotspot - drawn or not - so the untagged close-up of
 * a hidden or internal hotspot is never mistaken for a scene camera.
 */
const isHotspotCamera = (
	camera: ReturnCamera,
	links: readonly Linked[]
): boolean =>
	camera.kind === 'hotspot' ||
	(!camera.kind &&
		links.some((link) => link.linkedCameraId === camera.cameraId))

const findCamera = (
	cameras: readonly ReturnCamera[] | undefined,
	cameraId: null | string
): ReturnCamera | undefined =>
	cameraId ? cameras?.find((camera) => camera.cameraId === cameraId) : undefined

/**
 * The drawn marker whose close-up the view is on, or null.
 *
 * Null on a scene camera a marker happens to link: the visitor is standing in
 * the scene's own view, with nothing to go back from.
 */
export function resolveActiveHotspot<Marker extends Linked>(
	activeCameraId: null | string,
	cameras: readonly ReturnCamera[] | undefined,
	links: readonly Linked[],
	markers: readonly Marker[]
): Marker | null {
	const camera = findCamera(cameras, activeCameraId)
	if (!camera || !isHotspotCamera(camera, links)) return null
	return (
		markers.find((marker) => marker.linkedCameraId === camera.cameraId) ?? null
	)
}

/**
 * The scene camera to remember after the view lands on `cameraId`.
 *
 * Only a scene camera replaces it. Hopping from one marker to the next is
 * still one excursion away from where the visitor started, and the way back
 * leads there rather than to the previous marker.
 */
export function nextReturnCameraId(
	recorded: null | string,
	cameraId: null | string,
	cameras: readonly ReturnCamera[] | undefined,
	links: readonly Linked[]
): null | string {
	const camera = findCamera(cameras, cameraId)
	return camera && !isHotspotCamera(camera, links) ? camera.cameraId : recorded
}

/**
 * Where the way back leads: the scene camera the visitor was on, else the
 * scene's own default, else nothing.
 *
 * The fallback covers a view that opened on a hotspot camera, through a
 * `?camera=` link or a host's command, so no scene camera was ever recorded.
 * It follows `SceneCamera`'s order for the opening view among scene cameras.
 * Null means the scene has nowhere else to go, and the control is not drawn
 * rather than drawn leading nowhere.
 */
export function resolveReturnCameraId(
	recorded: null | string,
	cameras: readonly ReturnCamera[] | undefined,
	links: readonly Linked[]
): null | string {
	const candidates = (cameras ?? []).filter(
		(camera) => !isHotspotCamera(camera, links)
	)
	if (recorded && candidates.some((camera) => camera.cameraId === recorded)) {
		return recorded
	}

	return (
		(candidates.find((camera) => camera.initial) ?? candidates[0])?.cameraId ??
		null
	)
}

/**
 * Whether the open card belongs to a hotspot view the camera just left.
 *
 * A card describes the place its marker flew the view to. Once the view leaves
 * that camera - the way back, Escape, a camera switcher, a host - the card is
 * describing somewhere the visitor no longer is. A marker with no camera of its
 * own never moved the view, so its card is left alone.
 */
export function leftOpenHotspotView(
	openMarker: Linked | null | undefined,
	previousCameraId: null | string,
	activeCameraId: null | string
): boolean {
	const cameraId = openMarker?.linkedCameraId
	return (
		!!cameraId && previousCameraId === cameraId && activeCameraId !== cameraId
	)
}
