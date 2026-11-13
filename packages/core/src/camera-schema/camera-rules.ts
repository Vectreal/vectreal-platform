/**
 * The camera rules a reader needs, with no dependency at all, so the viewer
 * and every other bundle that reads a stored camera carries them for free.
 * The zod schema in `./index.ts` builds the write contract on these same
 * rules; only the platform and the SDK, which validate writes, load zod.
 */
import { isFramingAspect } from '../scene-camera/viewport-framing'

/**
 * Scene cameras are the ones a viewer can open on and switch between. Entries
 * with another `kind` (a hotspot's close-up) are reached through their marker.
 * A missing `kind` predates the field and means "scene".
 */
export const isSceneCamera = (camera: { kind?: string }): boolean =>
	!camera.kind || camera.kind === 'scene'

/**
 * A perspective lens's vertical field of view is in degrees, inside the open
 * range (0, 180). Outside it the projection is degenerate or inverted, and the
 * viewer draws nothing usable.
 */
export const CAMERA_FOV_MIN = 0
export const CAMERA_FOV_MAX = 180

/** Whether `value` is a field of view the viewer can set on its lens. */
export const isCameraFov = (value: unknown): value is number =>
	typeof value === 'number' &&
	Number.isFinite(value) &&
	value > CAMERA_FOV_MIN &&
	value < CAMERA_FOV_MAX

/** The camera fields that hold a vector. `lookAt` is the legacy `target`. */
export const CAMERA_VECTOR_FIELDS = [
	'position',
	'target',
	'rotation',
	'lookAt'
] as const

/** One stored value `repairCameraEntry` dropped, for whoever logs it. */
export interface CameraRepair {
	cameraIndex: number
	field: string
}

/**
 * What a read checks, field by field: only the numbers the viewer would
 * otherwise draw wrong. Everything else is carried exactly as stored. A
 * vector in particular is never touched: the viewer's reader already falls
 * back for one it cannot read, while the camera's other readers (the opening
 * pose, a hotspot camera's aim) treat any stored vector as "this camera has a
 * pose", so dropping one would change where the camera points.
 */
const READ_RULES: Record<string, (value: unknown) => boolean> = {
	fov: isCameraFov,
	framingAspect: isFramingAspect
}

/**
 * A stored camera with each value the viewer cannot use dropped, so it falls
 * back to its default for that field rather than drawing garbage. Never
 * refuses and never reshapes what it keeps: a published scene keeps opening
 * whatever an older save wrote.
 */
export function repairCameraEntry<Entry extends Record<string, unknown>>(
	entry: Entry,
	cameraIndex: number
): { entry: Entry; repairs: CameraRepair[] } {
	const repairs: CameraRepair[] = []
	for (const [field, readable] of Object.entries(READ_RULES)) {
		if (entry[field] !== undefined && !readable(entry[field])) {
			repairs.push({ cameraIndex, field })
		}
	}
	if (repairs.length === 0) return { entry, repairs }

	const repaired: Record<string, unknown> = { ...entry }
	for (const { field } of repairs) delete repaired[field]
	return { entry: repaired as Entry, repairs }
}
