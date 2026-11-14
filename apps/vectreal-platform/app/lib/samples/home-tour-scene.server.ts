import { parseEmbedUrl } from '../domain/embed/embed-scene-ref'
import {
	publishedEmbedSceneDeps,
	resolvePublishedEmbedScene,
	type PublishedEmbedScene
} from '../domain/embed/published-embed-scene.server'

/*
  Toured, not handled: the page's scroll moves the camera, so the scene draws
  no switcher, markers or hint, stays still between stations, and takes no
  drag until the reader is handed it.
*/
const TOUR_EMBED_OPTIONS = [
	['cameraControls', '0'],
	['hotspots', '0'],
	['hint', '0'],
	['autoRotate', '0']
] as const

export const homeTourDeps = {
	/**
	 * `HOME_TOUR_SCENE`: the embed URL of the published scene the home page's
	 * three-photos band tours, as the publisher's embed panel copies it, token
	 * included. Its saved cameras, in order, are the stations. Unset or empty
	 * is no tour, and the band shows its steps as they are.
	 */
	raw: () => process.env.HOME_TOUR_SCENE,
	...publishedEmbedSceneDeps
}

export type HomeTourDeps = typeof homeTourDeps

/**
 * The scene the home page tours on scroll, or null for none. Read per request
 * because the home page itself is prerendered once per build, and one build
 * serves both staging and production, which publish different scenes.
 */
export async function resolveHomeTour(
	request: Request,
	deps: HomeTourDeps = homeTourDeps
): Promise<PublishedEmbedScene | null> {
	const raw = deps.raw()?.trim()
	if (!raw) return null
	const ref = parseEmbedUrl(raw)
	if (!ref) {
		deps.reportServerError(
			new Error('HOME_TOUR_SCENE is not an embed URL with a token.'),
			{ request }
		)
		return null
	}
	return resolvePublishedEmbedScene(request, ref, TOUR_EMBED_OPTIONS, deps)
}
