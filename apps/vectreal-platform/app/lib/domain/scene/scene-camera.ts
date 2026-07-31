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
interface CameraLike {
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
