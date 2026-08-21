/**
 * Resolving the scene's default camera, and describing its pose.
 *
 * The default camera is the frame a viewer opens on, which makes it the same
 * frame the thumbnail has to show — the thumbnail is the placeholder rendered
 * during load, so any disagreement between the two shows up as a jump the
 * moment the scene appears.
 *
 * The `!kind || kind === 'scene'` test used to be written out at five call
 * sites. Having one definition is what keeps the thumbnail, the save-time
 * recapture, and the preview controls agreeing on which camera that is.
 *
 * Isomorphic and dependency-free, so the server-side settings parser can share
 * it with the client.
 */

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

/**
 * Scene cameras are the ones a viewer can open on. Entries with another `kind`
 * (annotation hotspots and the like) are navigational and never the default.
 * A missing `kind` predates the field and means "scene".
 */
export const isSceneCamera = (entry: CameraLike): boolean =>
	!entry.kind || entry.kind === 'scene'

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

export function resolveDefaultSceneCamera<Entry extends CameraLike>(
	cameras: Entry[] | null | undefined
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
