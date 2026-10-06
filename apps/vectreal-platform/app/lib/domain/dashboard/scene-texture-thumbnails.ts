import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

/** A thumbnail URL for each image asset, by asset id. */
export type TextureThumbnailUrls = Readonly<Record<string, string>>

interface ThumbnailAssetRow {
	id: string
	name: string
	mimeType: string | null
}

/**
 * Where the asset list's thumbnails come from: the scene's own image rows,
 * fetched by URL.
 *
 * Not from the bytes the viewer loaded. A published scene loads one GLB and
 * no editor assets, so there are no bytes to point at; and the URLs are the
 * same ones a draft's manifest uses, so a draft's images come from the HTTP
 * cache rather than a second download. Strings only: bytes passed through
 * props once froze the tab, because React's development render logging walks
 * changed props down to the byte.
 *
 * The saved scene thumbnail is not a texture of the model and is left out.
 */
export function buildTextureThumbnailUrls(
	assets: readonly ThumbnailAssetRow[],
	buildAssetUrl: (assetId: string) => string
): TextureThumbnailUrls {
	const urls: Record<string, string> = {}
	for (const asset of assets) {
		if (!asset.mimeType?.startsWith('image/')) continue
		if (asset.name === SCENE_THUMBNAIL_FILENAME) continue
		urls[asset.id] = buildAssetUrl(asset.id)
	}
	return urls
}
