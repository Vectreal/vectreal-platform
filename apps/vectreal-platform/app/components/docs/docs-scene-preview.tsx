import { lazy, Suspense } from 'react'

import { useIsClientMounted } from '../../hooks/use-is-client-mounted'
import { RenderFallbackBoundary } from '../errors/render-fallback-boundary'

const DocsScenePreviewClient = lazy(() => import('./docs-scene-preview-client'))

/**
 * Mount gate for the docs viewer.
 *
 * Two separate reasons, both load-bearing. The viewer needs a DOM, so it cannot
 * render during SSR - hence the mounted flag rather than a plain dynamic import.
 * And Three.js and the viewer are a large payload for a page that is mostly
 * text, so it is lazy and never blocks first paint.
 * The model rides in that same lazy chunk's wake, and is kept to 120 KB.
 *
 * The placeholder holds the same box at every stage, so the surrounding layout
 * does not shift when the viewer arrives.
 */
export function DocsScenePreview() {
	const isMounted = useIsClientMounted()

	// min-w-0 because the canvas has an intrinsic width and a grid or flex item
	// defaults to min-width: auto, so without it the track sizes to the canvas
	// and the page scrolls sideways on a phone.
	const frame =
		'ds-sunken relative aspect-video w-full min-w-0 overflow-hidden rounded-2xl'

	if (!isMounted) {
		return <div className={frame} aria-hidden="true" />
	}

	/*
	  aria-hidden on the mounted branch too, not just the placeholder. The model
	  is decoration; without it the reader is handed an unnamed <canvas> plus the
	  viewer's own role="status" aria-live overlay, so a spinning model announces
	  its loading state on a page the reader came to read.
	*/
	return (
		<div className={frame} aria-hidden="true">
			<RenderFallbackBoundary fallback={null}>
				<Suspense fallback={null}>
					<DocsScenePreviewClient />
				</Suspense>
			</RenderFallbackBoundary>
		</div>
	)
}
