import type { CameraConfig } from '@vctrl/core'

/** The view the viewer settled on at load, and the camera it was framed for. */
export interface OpeningPose {
	cameraId: string
	position: [number, number, number]
	target: [number, number, number]
}

/**
 * A camera with no pose of its own stands where the viewer framed it at load.
 *
 * A scene saved before the opening view was recorded keeps a default camera
 * with a field of view and nothing else. It opens fine, because the initial
 * fit frames the model, but activating it again later had nothing to fly to:
 * the view stayed wherever it was, so every way back to it (the viewer's own
 * "Back to scene view", leaving a hotspot camera in the publisher) selected it
 * and went nowhere.
 *
 * Only the camera the opening fit was made for. Any other camera without a
 * pose keeps meaning "stay here, look where you are looking", which is how a
 * hotspot camera saved before it had a viewpoint still behaves.
 */
export function withOpeningPose<T extends CameraConfig>(
	camera: T,
	openingPose: OpeningPose | null
): T {
	if (!openingPose || camera.cameraId !== openingPose.cameraId) return camera
	if (camera.position || camera.rotation || camera.target) return camera
	if ((camera as { lookAt?: unknown }).lookAt) return camera

	return {
		...camera,
		position: openingPose.position,
		target: openingPose.target
	}
}
