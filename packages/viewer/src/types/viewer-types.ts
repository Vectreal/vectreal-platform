export interface SceneScreenshotOptions {
	width?: number
	height?: number
	mimeType?: 'image/jpeg' | 'image/webp'
	quality?: number
	mode?: 'auto-fit' | 'viewport'
	/**
	 * Optional camera ID to capture from. If provided, the viewer will transition to
	 * that camera before capturing the screenshot, then return to the original camera.
	 * This is useful for capturing thumbnails from the default camera perspective.
	 */
	targetCameraId?: string
}

export interface SceneCameraSnapshot {
	position: [number, number, number]
	rotation: [number, number, number]
	target: [number, number, number]
	fov: number
}

export type SceneCameraSnapshotCapture =
	() => Promise<null | SceneCameraSnapshot>

export type SceneScreenshotCapture = (
	options?: SceneScreenshotOptions
) => Promise<null | string>

export interface ViewerLoadingThumbnail {
	src: string
	alt?: string
}

export type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from './viewer-interactions'
