/*
  Import-free, so the client-safe rule modules that read an embed URL from
  config (the intake's, the home tour's) take nothing else with it.
*/

/** A published scene, as its embed URL names it. */
export interface EmbedSceneRef {
	projectId: string
	sceneId: string
	/** The embed key the URL carries; the embed accepts nothing else. */
	token: string
}

const EMBED_PATH_PATTERN =
	/^\/embed\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

/**
 * The scene an embed URL names, the inverse of `buildEmbedUrl` in `embed-snippet.ts`: the URL
 * the publisher's embed panel copies, token included. Only its path and token
 * are read, so the scene has to live on the deployment that reads it. Null for
 * anything else, a URL without a token included.
 */
export function parseEmbedUrl(value: string): EmbedSceneRef | null {
	const url = URL.canParse(value) ? new URL(value) : null
	const ids = url && EMBED_PATH_PATTERN.exec(url.pathname)
	const token = url?.searchParams.get('token')?.trim()
	return ids && token ? { projectId: ids[1], sceneId: ids[2], token } : null
}
