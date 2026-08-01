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

/**
 * The state of the accumulative-shadow bake at save time, for persistence.
 * `signature` is always the current bake inputs' signature. `dataUrl` is a fresh
 * density PNG when a live bake settled and needs (re)persisting, or `null` when
 * the already-persisted bake is still valid for these inputs (no re-upload). A
 * `null` result from the capture function means there is nothing worth persisting
 * (no accumulative shadow, or the bake has not settled).
 */
export interface ShadowBakeResult {
	dataUrl: string | null
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

/**
 * The still image shown behind the canvas until the model is ready.
 *
 * Only `src` is required. Everything else describes how it is presented, and
 * every default reproduces the viewer's built-in look, so a consuming app opts
 * into changes rather than having to restate the defaults.
 */
export interface ViewerLoadingThumbnail {
	src: string
	alt?: string
	/**
	 * `false` renders the image sharp. A string replaces the default blur with
	 * your own class, e.g. `'blur-xl'`.
	 * @default true
	 */
	blur?: boolean | string
	/**
	 * The two scrims that tint the image towards the background color. `false`
	 * shows the thumbnail unmodified, which suits a shot that already matches
	 * the surrounding page.
	 * @default true
	 */
	scrim?: boolean
	/**
	 * `'contain'` fits the whole thumbnail into the canvas instead of filling it,
	 * so nothing is cropped.
	 * @default 'cover'
	 */
	objectFit?: 'contain' | 'cover'
	/**
	 * Applied to the image. Class conflicts resolve in favor of this value, so it
	 * can override any of the options above.
	 */
	className?: string
}

export type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from './viewer-interactions'
