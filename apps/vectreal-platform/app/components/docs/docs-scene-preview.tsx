import { lazy, Suspense, useEffect, useState } from 'react'

const DocsScenePreviewClient = lazy(() => import('./docs-scene-preview-client'))

/**
 * Mount gate for the docs viewer.
 *
 * Two separate reasons, both load-bearing. The viewer needs a DOM, so it cannot
 * render during SSR - hence the mounted flag rather than a plain dynamic import.
 * And Three.js plus a GLB is a large payload for a page whose job is to route
 * people to documentation, so it is lazy and never blocks first paint.
 *
 * The placeholder holds the same box at every stage, so the surrounding layout
 * does not shift when the viewer arrives.
 */
export function DocsScenePreview() {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	// min-w-0 because the canvas has an intrinsic width and a grid or flex item
	// defaults to min-width: auto, so without it the track sizes to the canvas
	// and the page scrolls sideways on a phone.
	const frame =
		'ds-sunken relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-2xl'

	if (!isMounted) {
		return <div className={frame} aria-hidden="true" />
	}

	/*
	  aria-hidden on the mounted branch too, not just the placeholder. The cube
	  is decoration; without it the reader is handed an unnamed <canvas> plus the
	  viewer's own role="status" aria-live overlay, so a spinning box announces
	  its loading state on a page whose job is routing people to documentation.
	*/
	return (
		<div className={frame} aria-hidden="true">
			<Suspense fallback={null}>
				<DocsScenePreviewClient />
			</Suspense>
		</div>
	)
}
