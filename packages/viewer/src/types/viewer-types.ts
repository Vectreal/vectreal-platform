export interface SceneScreenshotOptions {
	width?: number
	height?: number
	mimeType?: 'image/jpeg' | 'image/webp'
	quality?: number
	mode?: 'auto-fit' | 'viewport'
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
