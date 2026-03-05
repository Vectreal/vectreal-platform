export interface SceneScreenshotOptions {
	width?: number
	height?: number
	mimeType?: 'image/jpeg' | 'image/webp'
	quality?: number
	mode?: 'auto-fit' | 'viewport'
}

export type SceneScreenshotCapture = (
	options?: SceneScreenshotOptions
) => Promise<null | string>

export interface ViewerLoadingThumbnail {
	src: string
	alt?: string
}
