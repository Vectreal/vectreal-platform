/** How a manifest request authenticated. */
export type SceneManifestCaller = 'apiKey' | 'session'

/**
 * Which manifest a request receives.
 *
 * - `embed`: the published GLB, the redacted settings and only the assets an
 *   embed may fetch.
 * - `working`: the editor's draft, with every scene asset.
 * - `not-found`: nothing to serve this caller.
 */
export type SceneManifestKind = 'embed' | 'working' | 'not-found'

/**
 * The one rule deciding what a scene manifest describes.
 *
 * A published scene is shown as published to everyone, so `/preview` and the
 * dashboard render what a visitor gets rather than the draft. The credential
 * decides only whether a draft is reachable at all: a key exists to serve
 * published scenes and nothing else.
 */
export function chooseSceneManifestKind({
	hasPublication,
	caller
}: {
	hasPublication: boolean
	caller: SceneManifestCaller
}): SceneManifestKind {
	if (hasPublication) return 'embed'
	return caller === 'session' ? 'working' : 'not-found'
}
