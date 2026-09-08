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

	const frame =
		'ds-sunken relative aspect-[4/3] w-full overflow-hidden rounded-2xl'

	if (!isMounted) {
		return <div className={frame} aria-hidden="true" />
	}

	return (
		<div className={frame}>
			<Suspense fallback={null}>
				<DocsScenePreviewClient />
			</Suspense>
		</div>
	)
}
