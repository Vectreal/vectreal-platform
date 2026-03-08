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
 * @returns The loading state and transition completion callback
 */
export function useViewerLoading(
	hasContent: boolean,
	isInitialFramingComplete: boolean
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
			setLoadingState('loaded')
		} else if (!canTransitionToLoaded && loadingState !== 'loading') {
			// Content was removed or no longer framed, go back to loading.
			setLoadingState('loading')
		}
	}, [canTransitionToLoaded, loadingState])

	return {
		loadingState,
		completeLoadingTransition
	}
}

export type { LoadingState }
