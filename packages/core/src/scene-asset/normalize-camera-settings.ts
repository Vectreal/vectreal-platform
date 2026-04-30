import type { CameraProps } from '../types'

/**
 * Normalizes the canonical camera payload without performing legacy migration.
 *
 * This helper only resolves a stable `activeCameraId`, fills missing top-level
 * camera ids/names, and keeps `initial` aligned with the selected camera.
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

	const activeCameraId =
		(camera.activeCameraId &&
		normalizedCameras.some((entry) => entry.cameraId === camera.activeCameraId)
			? camera.activeCameraId
			: undefined) ??
		normalizedCameras.find((entry) => entry.initial)?.cameraId ??
		normalizedCameras[0]?.cameraId

	if (!activeCameraId) {
		return camera
	}

	return {
		...camera,
		activeCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			initial: entry.cameraId === activeCameraId
		}))
	}
}
