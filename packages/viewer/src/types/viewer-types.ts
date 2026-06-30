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

/** A captured accumulative-shadow bake: a density PNG data URL + its signature. */
export interface ShadowBakeResult {
	dataUrl: string
	signature: string
}

/**
 * A persisted accumulative-shadow bake. When present and its signature still
 * matches the current bake inputs, the viewer renders the stored texture and
 * skips re-baking entirely.
 */
export interface BakedShadow {
	/** URL of the stored shadow-density PNG (alpha channel = shadow density). */
	url: string
	/** Bake signature the texture was captured with. */
	signature: string
}

/**
 * Captures the settled accumulative-shadow bake for persistence. Resolves null if
 * the bake has not settled yet (nothing worth storing).
 */
export type ShadowBakeCapture = () => Promise<null | ShadowBakeResult>

export interface ViewerLoadingThumbnail {
	src: string
	alt?: string
}

export type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from './viewer-interactions'
