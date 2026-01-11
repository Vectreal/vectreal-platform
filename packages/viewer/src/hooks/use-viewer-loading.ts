import { useEffect, useState } from 'react'

type LoadingState = 'loading' | 'loaded' | 'ready'

/**
 * Hook to manage the loading state of the viewer.
 * Handles transitions between loading, loaded, and ready states.
 *
 * @param hasContent - Whether the viewer has content to display (model or children)
 * @returns The current loading state
 */
export function useViewerLoading(hasContent: boolean): LoadingState {
	const [loadingState, setLoadingState] = useState<LoadingState>('loading')

	useEffect(() => {
		if (hasContent && loadingState === 'loading') {
			// Content just became available, start fade transition
			setLoadingState('loaded')

			// TODO: Replace setTimeout with transitionend event listener for more robust animation handling
			// After loader fade-out completes, mark as ready
			const timer = setTimeout(() => {
				setLoadingState('ready')
			}, 500)

			return () => clearTimeout(timer)
		} else if (!hasContent && loadingState !== 'loading') {
			// Content was removed, go back to loading
			setLoadingState('loading')
		}
	}, [hasContent, loadingState])

	return loadingState
}

export type { LoadingState }
