import type { ViewerLoadingThumbnail } from '@vctrl/viewer'

const DEFAULT_LOADING_THUMBNAIL_ALT = 'Scene loading thumbnail'

/**
 * The stored scene thumbnail as the viewer's loading backdrop.
 *
 * Contained, never covered. The thumbnail is the viewer's own 16:9 frame of the
 * opening camera, and the viewer only backs that camera off on a viewport
 * narrower than it was framed for (`framingScale` in `@vctrl/core`), so the
 * whole 16:9 image centered in the viewport puts the model where it loads.
 * For a camera framed at 16:9 its size matches at the orbit target's depth,
 * less the backdrop's own entry zoom (5% while loading, settling as it fades).
 * Parts nearer the camera load somewhat smaller on a narrow viewport, because
 * backing off flattens perspective and a flat image cannot; below about 0.44:1
 * the back-off hits its 4x cap and the loaded model is the larger.
 *
 * Cover crops the image to the viewport instead, which enlarged the model on
 * any other aspect (about 1.4x on the dashboard's scene panel), so it jumped
 * smaller on load.
 *
 * The bands around the image show the viewer's container: the scene's stage
 * when it has a color or gradient one, otherwise whatever is behind the
 * viewer, which a stageless capture shows through its transparency too. An
 * environment shown as the background is the one case where the image and the
 * bands differ.
 */
export function toViewerLoadingThumbnail(
	thumbnailUrl: null | string | undefined,
	alt: string = DEFAULT_LOADING_THUMBNAIL_ALT
): ViewerLoadingThumbnail | undefined {
	if (!thumbnailUrl) {
		return undefined
	}

	const normalizedUrl = thumbnailUrl.trim()
	if (!normalizedUrl) {
		return undefined
	}

	return {
		src: normalizedUrl,
		alt,
		objectFit: 'contain'
	}
}
