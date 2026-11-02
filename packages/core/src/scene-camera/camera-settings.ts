import { isFramingAspect } from './viewport-framing'

import type {
	CameraConfig,
	CameraProps,
	CameraTransitionConfig
} from '../types'

/**
 * Scene cameras are the ones a viewer can open on and switch between. Entries
 * with another `kind` (a hotspot's close-up) are reached through their marker.
 * A missing `kind` predates the field and means "scene".
 *
 * The one definition. Normalization, the viewer's opening camera and the
 * platform's default-camera and embed rules all ask it, so they cannot drift
 * apart on which camera a scene opens on.
 */
export const isSceneCamera = (camera: { kind?: string }): boolean =>
	!camera.kind || camera.kind === 'scene'

/** The camera a scene falls back to when it stores none. */
export const DEFAULT_CAMERA: CameraConfig = {
	cameraId: 'default',
	name: 'Default Camera',
	fov: 60,
	initial: true
}

/**
 * How a scene that stores no transition moves between cameras: Smart, over a
 * second, eased at both ends.
 *
 * Smart flies in orbit space and keeps `SMART_FLIGHT_CLEARANCE` outside the
 * model's bounding sphere, so a move between cameras on opposite sides turns
 * around the subject rather than passing through it, and the clearance scales
 * with the model. A scene that stores a transition keeps it.
 */
export const DEFAULT_SCENE_TRANSITION: Readonly<
	Required<Pick<CameraTransitionConfig, 'type' | 'duration' | 'easing'>>
> = {
	type: 'object_avoidance',
	duration: 1000,
	easing: 'ease_in_out'
}

/**
 * Normalizes the canonical camera payload and enforces implicit first-camera defaults.
 *
 * This helper:
 * 1. Finds the first scene camera (non-hotspot) and marks it as initial
 * 2. Resolves a stable `activeCameraId` that points to the first scene camera
 * 3. Fills missing camera ids/names
 * 4. Keeps `initial` flag aligned with the active camera
 * 5. Drops a `framingAspect` that `isFramingAspect` refuses
 *
 * The semantic is: the first scene camera is ALWAYS the default unless explicitly
 * reordered by the user (moving a camera to the front via the pin action).
 */
export function normalizeCameraSettings(
	camera?: CameraProps
): CameraProps | undefined {
	if (!camera?.cameras || camera.cameras.length === 0) {
		return camera
	}

	const normalizedCameras = camera.cameras.map((entry, index) => {
		const { framingAspect, ...rest } = entry
		return {
			...rest,
			cameraId: entry.cameraId || `camera-${index + 1}`,
			name: entry.name || `Camera ${index + 1}`,
			// Dropped rather than repaired: an absent aspect has a defined meaning
			// in the viewer, a malformed one does not.
			...(isFramingAspect(framingAspect) ? { framingAspect } : {})
		}
	})

	// Find the first scene camera (non-hotspot)
	const firstSceneCameraId = normalizedCameras.find(isSceneCamera)?.cameraId

	if (!firstSceneCameraId) {
		return camera
	}

	return {
		...camera,
		// Always set activeCameraId to the first scene camera (implicit default)
		activeCameraId: firstSceneCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			// Mark first scene camera as initial; all others as non-initial
			initial: entry.cameraId === firstSceneCameraId
		}))
	}
}
