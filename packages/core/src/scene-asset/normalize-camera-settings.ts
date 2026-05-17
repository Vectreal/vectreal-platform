import type { CameraProps } from '../types'

/**
 * Normalizes the canonical camera payload and enforces implicit first-camera defaults.
 *
 * This helper:
 * 1. Strips legacy `defaultCameraStrategy` and `defaultCameraId` fields
 * 2. Finds the first scene camera (non-hotspot) and marks it as initial
 * 3. Resolves a stable `activeCameraId` that points to the first scene camera
 * 4. Fills missing camera ids/names
 * 5. Keeps `initial` flag aligned with the active camera
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

	const normalizedCameras = camera.cameras.map((entry, index) => ({
		...entry,
		cameraId: entry.cameraId || `camera-${index + 1}`,
		name: entry.name || `Camera ${index + 1}`
	}))

	// Find the first scene camera (non-hotspot)
	const firstSceneCameraId = normalizedCameras.find(
		(entry) => !entry.kind || entry.kind === 'scene'
	)?.cameraId

	if (!firstSceneCameraId) {
		return camera
	}

	return {
		...camera,
		// Strip legacy fields to prevent confusion
		defaultCameraStrategy: undefined,
		defaultCameraId: undefined,
		// Always set activeCameraId to the first scene camera (implicit default)
		activeCameraId: firstSceneCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			// Mark first scene camera as initial; all others as non-initial
			initial: entry.cameraId === firstSceneCameraId
		}))
	}
}
