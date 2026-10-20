import { lazy, Suspense } from 'react'

import type { DraftingBackdropProps } from './drafting-backdrop-client'

/*
  Lazy so no route's first load carries the floor, not even its wrapper: the
  page heads on pricing, contact and the newsroom sit at the edge of their JS
  budgets, and the floor draws after hydration either way.
*/
const DraftingBackdropClient = lazy(() => import('./drafting-backdrop-client'))

/** The drafting floor behind a section. See `DraftingBackdropClient`. */
export function DraftingBackdrop(props: DraftingBackdropProps) {
	return (
		<Suspense fallback={null}>
			<DraftingBackdropClient {...props} />
		</Suspense>
	)
}
