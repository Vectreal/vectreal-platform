import type {
	SceneScreenshotCapture,
	SceneScreenshotOptions
} from '@vctrl/viewer'

let sceneScreenshotCaptureHandler: null | SceneScreenshotCapture = null

export function registerSceneScreenshotCaptureHandler(
	handler: null | SceneScreenshotCapture
) {
	sceneScreenshotCaptureHandler = handler
}

export async function requestSceneScreenshot(
	options?: SceneScreenshotOptions
): Promise<null | string> {
	if (!sceneScreenshotCaptureHandler) {
		return null
	}

	return sceneScreenshotCaptureHandler(options)
}
