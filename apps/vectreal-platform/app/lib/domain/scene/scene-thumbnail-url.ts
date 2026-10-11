/**
 * The one shape a stored scene thumbnail URL takes.
 *
 * `scenes.thumbnail_url` holds a path to the session thumbnail route, never the
 * image. The publisher builds it after uploading the capture, and the save
 * parser refuses anything else, so both sides read the shape from here.
 */
export function buildSceneThumbnailUrl(
	sceneId: string,
	assetId: string
): string {
	return `/api/scenes/${sceneId}/thumbnail/${assetId}`
}

/**
 * The asset id a thumbnail URL names, or null. Anchored to the end so only the
 * final `/thumbnail/<id>` segment is taken.
 */
export function thumbnailAssetIdFromUrl(
	thumbnailUrl?: string | null
): string | null {
	if (!thumbnailUrl) return null
	const match = thumbnailUrl.match(/\/thumbnail\/([^/?#]+)$/)
	return match ? match[1] : null
}
