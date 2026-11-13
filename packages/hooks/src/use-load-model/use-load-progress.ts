import { useMemo } from 'react'

import type { ModelState } from './types'
import type { LoadProgress } from '@vctrl/core'

/**
 * A loading state's progress as the value the viewer's `loadProgress` and
 * every progress indicator read, or null when nothing is loading.
 *
 * Memoized on the fields, so a viewer handed it re-renders, and tells its
 * host, only when the load moves.
 */
export function useLoadProgress(state: ModelState): LoadProgress | null {
	const loading = state.status === 'loading' ? state : null
	const phase = loading?.phase
	const bytes = loading?.bytes
	const items = loading?.items
	return useMemo(
		() => (phase ? { phase, bytes, items } : null),
		[phase, bytes, items]
	)
}
