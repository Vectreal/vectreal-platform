import type { ModelState } from '@vctrl/hooks/use-load-model'

/**
 * What the publisher shows. Exactly one of these is true at any moment.
 *
 * - `empty`: nothing to show and nowhere to get it from, so the stage asks for a file.
 * - `loading`: a model is on its way.
 * - `viewer`: a model is on screen.
 * - `error`: the load that should have produced a model failed.
 */
export type PublisherSurface = 'empty' | 'loading' | 'viewer' | 'error'

interface PublisherSurfaceInput {
	/** The loader's status. */
	status: ModelState['status']
	/**
	 * Whether there is a saved scene to put on screen. A scene id in the URL is
	 * not enough: the loader only ships a manifest for a scene the viewer is
	 * allowed to read, and without one there is nothing to wait for.
	 */
	hasScene: boolean
	/**
	 * Whether a model is on its way that the loader has not been handed yet:
	 * a navigation within the publisher, a draft being read back, a variant
	 * downloading.
	 */
	isNavigating?: boolean
}

/**
 * The publisher's single rendering decision, in one place.
 *
 * The page and the shell chrome both call this, which is the point: they used to
 * answer the same question from different state and could show the drop zone and
 * the editor chrome at the same time.
 *
 * The route decides what "no model" means. On the base route it is an
 * invitation, and a rejected file leaves the empty stage standing with a toast
 * saying why. On a scene route there is nothing to upload into, so the same
 * absence is either a load on its way or one that failed.
 */
export function resolvePublisherSurface({
	status,
	hasScene,
	isNavigating = false
}: PublisherSurfaceInput): PublisherSurface {
	if (status === 'ready') return 'viewer'
	if (status === 'error' && hasScene) return 'error'
	// Ahead of a failed upload: a model on its way replaces the stage the
	// failure left standing.
	if (status === 'loading' || isNavigating) return 'loading'

	return hasScene ? 'loading' : 'empty'
}
