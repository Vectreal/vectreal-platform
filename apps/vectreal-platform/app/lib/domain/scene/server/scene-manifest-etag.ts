/** The publication an embed manifest describes: which GLB, published when. */
export interface ManifestPublication {
	assetId: string
	publishedAt: Date
}

/**
 * Returns a weak ETag for the scene manifest based on the scene ID and the
 * timestamp of the last settings save. Returns null when no timestamp is
 * available so callers can skip caching headers entirely.
 *
 * An embed manifest also names a publication, which is folded into its tag.
 * Publishing does not touch the settings row, so a tag keyed on the settings
 * alone survived a republish: the browser revalidated, got a 304, and kept a
 * manifest pointing at the previous GLB, which publishing had already
 * garbage-collected.
 *
 * The publication also keeps the embed and session manifests for one scene in
 * separate cache entries. They carry different fields from the same
 * `settingsUpdatedAt`, so a shared tag would let one be served in place of the
 * other.
 */
export function buildSceneManifestEtag(
	sceneId: string,
	settingsUpdatedAt: string | null,
	publication: ManifestPublication | null = null
): string | null {
	if (!settingsUpdatedAt) return null
	if (!publication) return `W/"scene-${sceneId}-${settingsUpdatedAt}"`
	return `W/"scene-embed-${sceneId}-${settingsUpdatedAt}-${publication.assetId}-${publication.publishedAt.toISOString()}"`
}
