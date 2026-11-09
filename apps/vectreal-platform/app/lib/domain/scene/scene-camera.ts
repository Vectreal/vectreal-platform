/**
 * Resolving the scene's default camera, and describing its pose.
 *
 * The default camera is the frame a viewer opens on, which makes it the same
 * frame the thumbnail has to show — the thumbnail is the placeholder rendered
 * during load, so any disagreement between the two shows up as a jump the
 * moment the scene appears.
 *
 * Which cameras are scene cameras is `isSceneCamera` in `@vctrl/core`, the
 * one definition the viewer and normalization use too. Sharing it is what
 * keeps the thumbnail, the save-time recapture, and the preview controls
 * agreeing on which camera that is.
 *
 * Isomorphic, so the server-side settings parser can share it with the client.
 */
import { isSceneCamera } from '@vctrl/core'

/**
 * Structural minimum for a camera entry.
 *
 * Pose fields are `unknown` on purpose: the viewer accepts several shapes for
 * them (tuple, Vector3, plain number for some), and nothing here inspects them
 * beyond serializing them into a comparison key.
 */
export interface CameraLike {
	cameraId?: string
	kind?: string
	position?: unknown
	rotation?: unknown
	target?: unknown
	lookAt?: unknown
	fov?: unknown
}

/** Id prefix the publisher mints every hotspot-paired camera with. */
export const PAIRED_HOTSPOT_CAMERA_ID_PREFIX = 'hotspot-camera-'

/**
 * The full minted shape: `hotspot-camera-<epoch millis>-<base36 suffix>`.
 *
 * The whole shape, not the bare prefix, because ordinary camera ids are
 * slugified from the camera's name (`deriveUniqueSlug`). Someone who names a
 * camera "Hotspot Camera 1" gets the id `hotspot-camera-1`, and a prefix test
 * would call that composed camera a hotspot pair. A slugified name cannot
 * produce a 13-digit epoch followed by a base36 suffix.
 */
const PAIRED_HOTSPOT_CAMERA_ID = /^hotspot-camera-\d{10,}-[a-z0-9]{1,8}$/

/**
 * Whether a camera was minted as a hotspot's pair rather than composed by hand.
 *
 * `kind` is the answer whenever it is there. It is not always there: the
 * publisher only started tagging paired cameras recently, so every scene saved
 * before that has an untagged one, and {@link isSceneCamera} reads a missing
 * `kind` as "scene". The minted id is what identifies those, and it is
 * reliable - `addHotspot` has always built the id this way.
 *
 * Read-side only, and deliberately not used to decide what a hotspot owns:
 * `resolveOwnedCameraId` takes the `kind` tag alone, because retiring a camera
 * is destructive and `isSceneCamera` still counts an untagged one as a frame
 * the scene can open on. This looser rule is for the callers where guessing
 * wrong hides a viewpoint instead of destroying it - the embed manifest, which
 * uses it to decide which cameras an `internalOnly` hotspot takes with it.
 */
export const isPairedHotspotCamera = (entry: CameraLike): boolean =>
	entry.kind === 'hotspot' ||
	(entry.kind === undefined &&
		entry.cameraId !== undefined &&
		PAIRED_HOTSPOT_CAMERA_ID.test(entry.cameraId))

/**
 * A scene's cameras with `kind: 'scene'` written on every untagged camera
 * that is not a hotspot's minted pair. The minted pairs are left as they are.
 *
 * The viewer reads an untagged camera that a hotspot links as that hotspot's
 * close-up. That is right for a pair saved before the tag existed, and wrong
 * for a scene camera an author linked: the Publisher's starting camera was
 * saved untagged, so linking it dropped the scene's own view out of the
 * camera switcher and left the way back with nowhere to lead.
 *
 * Only ever `'scene'`, and only where every rule here already reads the camera
 * as a scene camera (`isSceneCamera` takes a missing `kind` as one), so the
 * one reader this changes is the viewer's guess. The minted pairs keep their
 * missing tag on purpose. Writing `'hotspot'` on them would move a scene's
 * opening view off one an author pinned, and would hand them to the
 * destructive ownership rule, which keys on the tag alone.
 */
export function withSceneCameraKinds<Camera extends { cameras?: CameraLike[] }>(
	camera: Camera
): Camera {
	const cameras = camera.cameras
	if (
		!cameras?.some(
			(entry) => entry.kind === undefined && !isPairedHotspotCamera(entry)
		)
	) {
		return camera
	}
	return {
		...camera,
		cameras: cameras.map((entry) =>
			entry.kind === undefined && !isPairedHotspotCamera(entry)
				? { ...entry, kind: 'scene' }
				: entry
		)
	}
}

export function resolveDefaultSceneCamera<Entry extends CameraLike>(
	cameras: readonly Entry[] | null | undefined
): Entry | null {
	if (!cameras?.length) return null
	return cameras.find(isSceneCamera) ?? cameras[0] ?? null
}

export function resolveDefaultSceneCameraId(
	cameras: CameraLike[] | null | undefined
): string | undefined {
	return resolveDefaultSceneCamera(cameras)?.cameraId
}

/**
 * A scene's cameras in the order the Publisher lists them: the switcher's
 * views first, in saved order, then every other camera (a hotspot's close-up).
 *
 * `viewIds` are the cameras the viewer's switcher steps through, which the
 * caller takes from `resolveSceneViewCameras` in `@vctrl/viewer`. That rule
 * reads hotspot links as well as `kind` (an untagged camera a hotspot links is
 * that hotspot's close-up), and it is passed in rather than restated here
 * because this module is isomorphic and the server parser must not bundle the
 * viewer. Using the switcher's own rule is what makes the list's order the
 * switcher's order.
 *
 * Views are scene cameras, and every move writes them ahead of the rest, so
 * after a move the first view is also the first scene camera: the opening view.
 */
export function partitionSceneCameras<Entry extends CameraLike>(
	cameras: readonly Entry[] | null | undefined,
	viewIds: ReadonlySet<string>
): { sceneCameras: Entry[]; otherCameras: Entry[] } {
	const isView = (entry: Entry) =>
		entry.cameraId !== undefined && viewIds.has(entry.cameraId)

	return {
		sceneCameras: (cameras ?? []).filter(isView),
		otherCameras: (cameras ?? []).filter((entry) => !isView(entry))
	}
}

/** One move through the scene cameras' order, or `null` when it is not one. */
export interface SceneCameraMove<Entry> {
	/** Every camera: the scene cameras in their new order, then the rest. */
	cameras: Entry[]
	/** 1-based place the moved camera landed in; 1 means the opening view. */
	position: number
	/** How many scene cameras the order holds. */
	total: number
}

/**
 * Puts the switcher's views (see {@link partitionSceneCameras}) in the order
 * given, ahead of every other camera. The first becomes the camera the scene
 * opens on, because `resolveDefaultSceneCamera` reads the first scene camera
 * and nothing else.
 *
 * A drag list is not trustworthy input, so the order is resolved against the
 * cameras that exist: ids naming no scene camera, and repeats, take no place,
 * and a scene camera the order leaves out (one added while a drag was in
 * flight) keeps its relative place at the end rather than being dropped.
 *
 * Two orders are not moves: one that changes neither the views' order nor
 * the opening camera (a drag released where it began), and one that names no scene camera
 * here or not the moved one (a drag that outlived a scene load or the camera's
 * deletion). Announcing either would describe a change that did not happen.
 */
export function applySceneCameraMove<Entry extends CameraLike>(
	cameras: readonly Entry[],
	orderedIds: readonly string[],
	movedId: string,
	viewIds: ReadonlySet<string>
): SceneCameraMove<Entry> | null {
	const { sceneCameras, otherCameras } = partitionSceneCameras(cameras, viewIds)
	const byId = new Map(
		sceneCameras.map((entry) => [entry.cameraId, entry] as const)
	)

	const placed = new Set<Entry>()
	for (const id of orderedIds) {
		const entry = byId.get(id)
		if (entry) placed.add(entry)
	}
	if (placed.size === 0) return null
	const moved = byId.get(movedId)
	if (!moved || !placed.has(moved)) return null

	const ordered = [
		...placed,
		...sceneCameras.filter((entry) => !placed.has(entry))
	]
	// A move changes what a visitor sees: the views' order, or the camera the
	// scene opens on. The second counts on its own only in a legacy scene,
	// where a camera that is not a view sits ahead of the views and opens the
	// scene: moving the first view to the top then makes it the opening view.
	// Only the moved camera can claim that, so a drag released in place on any
	// other row stays a no-op, as does tidying the other cameras to the tail.
	const next = [...ordered, ...otherCameras]
	const sameViews = ordered.every(
		(entry, index) => entry === sceneCameras[index]
	)
	const opensNow = resolveDefaultSceneCamera(next)
	const claimsOpening =
		opensNow === moved && opensNow !== resolveDefaultSceneCamera(cameras)
	if (sameViews && !claimsOpening) return null

	return {
		cameras: next,
		position: ordered.indexOf(moved) + 1,
		total: ordered.length
	}
}

/**
 * Whether the scene has no other camera it could open on.
 *
 * Deleting this one does not leave the scene without a default:
 * `resolveDefaultSceneCamera` falls back to the first entry of any kind, so a
 * navigational camera quietly becomes the frame the scene opens on instead.
 */
export function isLastSceneCamera(
	cameras: CameraLike[] | null | undefined,
	cameraId: string
): boolean {
	const sceneCameras = cameras?.filter(isSceneCamera) ?? []
	return sceneCameras.length === 1 && sceneCameras[0].cameraId === cameraId
}

/**
 * Marks the camera the scene opens on and clears the flag from every other
 * entry, including one that held it before the array changed.
 *
 * Both the compose panel and the server parser re-derive this on every write,
 * which is two chances for the answer to disagree with
 * `resolveDefaultSceneCamera`. Neither of them writes it out by hand any more.
 */
export function applyDefaultCameraFlag<Entry extends CameraLike>(
	cameras: Entry[]
): (Entry & { initial: boolean })[] {
	const defaultCamera = resolveDefaultSceneCamera(cameras)

	return cameras.map((entry) => ({
		...entry,
		initial: entry === defaultCamera
	}))
}

/**
 * A stable description of which camera opens the scene and where it sits.
 *
 * Comparing identity alone was not enough: nudging the default camera's pose
 * left the saved thumbnail showing the old framing, because nothing detected
 * that the opening view had moved. Including the pose here is what lets the
 * save path notice and recapture.
 */
export function buildDefaultCameraSignature(
	cameras: CameraLike[] | null | undefined
): null | string {
	const camera = resolveDefaultSceneCamera(cameras)
	if (!camera) return null

	return JSON.stringify({
		cameraId: camera.cameraId ?? null,
		position: camera.position ?? null,
		rotation: camera.rotation ?? null,
		target: camera.target ?? camera.lookAt ?? null,
		fov: camera.fov ?? null
	})
}
