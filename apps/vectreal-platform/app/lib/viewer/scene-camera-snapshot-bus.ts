import type { SceneCameraSnapshotCapture } from '@vctrl/viewer'

let sceneCameraSnapshotCaptureHandler: null | SceneCameraSnapshotCapture = null

export function registerSceneCameraSnapshotCaptureHandler(
	handler: null | SceneCameraSnapshotCapture
) {
	sceneCameraSnapshotCaptureHandler = handler
}

export async function requestSceneCameraSnapshot() {
	if (!sceneCameraSnapshotCaptureHandler) {
		return null
	}

	return sceneCameraSnapshotCaptureHandler()
}
