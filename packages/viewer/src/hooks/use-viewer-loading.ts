import { useCallback, useEffect, useState } from 'react'

type LoadingState = 'loading' | 'loaded' | 'ready'

interface UseViewerLoadingResult {
	loadingState: LoadingState
	completeLoadingTransition: () => void
}

/**
 * Hook to manage the loading state of the viewer.
 * Handles transitions between loading, loaded, and ready states.
 *
 * @param hasContent - Whether the viewer has content to display (model or children)
 * @param isInitialFramingComplete - Whether initial camera framing via bounds has stabilized
 * @param hasLoader - Whether a loader element will render, and therefore whether
 *   there is a fade-out to wait for. `loaded` exists only to cover that fade,
 *   and it is left by the loader's own `transitionend`; a consumer passing
 *   `loader={null}` schedules no transition, so without this the state stranded
 *   at `loaded` and every piece of viewer chrome stayed hidden for good.
 * @returns The loading state and transition completion callback
 */
export function useViewerLoading(
	hasContent: boolean,
	isInitialFramingComplete: boolean,
	hasLoader: boolean
): UseViewerLoadingResult {
	const [loadingState, setLoadingState] = useState<LoadingState>('loading')
	const canTransitionToLoaded = hasContent && isInitialFramingComplete
	const completeLoadingTransition = useCallback(() => {
		setLoadingState((currentState) =>
			currentState === 'loaded' ? 'ready' : currentState
		)
	}, [])

	useEffect(() => {
		if (canTransitionToLoaded && loadingState === 'loading') {
			// Content is framed and visible, begin cross-fade transition.
			// With no loader on screen there is nothing to cross-fade with, so the
			// intermediate state would never be left.
			setLoadingState(hasLoader ? 'loaded' : 'ready')
		} else if (!canTransitionToLoaded && loadingState !== 'loading') {
			// Content was removed or no longer framed, go back to loading.
			setLoadingState('loading')
		}
	}, [canTransitionToLoaded, hasLoader, loadingState])

	return {
		loadingState,
		completeLoadingTransition
	}
}

export type { LoadingState }
