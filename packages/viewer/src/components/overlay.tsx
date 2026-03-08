import { cn } from '@shared/utils'

import LoadingShadowPlane from './loading-shadow-plane'
import LoadingThumbnailBackdrop from './loading-thumbnail-backdrop'
import { VIEWER_LOADING_FADE_DURATION_MS } from '../hooks/viewer-loading.constants'

import type { LoadingState } from '../hooks/use-viewer-loading'
import type { ViewerLoadingThumbnail } from '../types/viewer-types'

interface OverlayProps {
	loadingState: LoadingState
	onLoaderFadeOutComplete?: () => void
	popover?: React.ReactNode
	loader?: React.ReactNode
	loadingThumbnail?: ViewerLoadingThumbnail
}

const Overlay = ({
	loadingState,
	onLoaderFadeOutComplete,
	popover,
	loader,
	loadingThumbnail
}: OverlayProps) => {
	const showLoader = loadingState !== 'ready'
	const isLoaded = loadingState === 'loaded'

	return (
		<>
			{showLoader && loader && (
				<div
					className={cn(
						'absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 transition-[opacity,filter] ease-out',
						isLoaded
							? 'pointer-events-none opacity-0 blur-[1px]'
							: 'blur-0 opacity-100'
					)}
					style={{
						transitionDuration: `${VIEWER_LOADING_FADE_DURATION_MS}ms`
					}}
					data-loading-state={loadingState}
					role="status"
					aria-live="polite"
					aria-busy={true}
					onTransitionEnd={(event) => {
						if (
							event.target === event.currentTarget &&
							event.propertyName === 'opacity' &&
							isLoaded
						) {
							onLoaderFadeOutComplete?.()
						}
					}}
				>
					{loadingThumbnail && (
						<LoadingThumbnailBackdrop
							thumbnail={loadingThumbnail}
							isLoaded={isLoaded}
						/>
					)}
					<LoadingShadowPlane />
					<div
						className={cn(
							'relative z-10 transition-[opacity,transform] duration-500 ease-out',
							isLoaded ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
						)}
					>
						{loader}
					</div>
				</div>
			)}
			{popover}
		</>
	)
}

export default Overlay
