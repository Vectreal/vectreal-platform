import type { ViewerLoadingThumbnail } from '@vctrl/viewer'

const DEFAULT_LOADING_THUMBNAIL_ALT = 'Scene loading thumbnail'

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
		alt
	}
}
