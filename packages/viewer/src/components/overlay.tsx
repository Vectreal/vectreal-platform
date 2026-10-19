import { cn } from './class-names'
import LoadingShadowPlane from './loading-shadow-plane'
import LoadingThumbnailBackdrop from './loading-thumbnail-backdrop'
import { isViewerChromeVisible } from './overlay-chrome-visibility'
import { VIEWER_LOADING_FADE_DURATION_MS } from '../hooks/viewer-loading.constants'

import type { LoadingState } from '../hooks/use-viewer-loading'
import type { ViewerLoadingThumbnail } from '../types/viewer-types'

interface OverlayProps {
	loadingState: LoadingState
	onLoaderFadeOutComplete?: () => void
	popover?: React.ReactNode
	/** Playback controls, when the scene author has opted into them. */
	animationControls?: React.ReactNode
	/** The switcher between scene cameras, when there is more than one. */
	cameraControls?: React.ReactNode
	/** The way back from a hotspot's camera. */
	sceneViewReturn?: React.ReactNode
	loader?: React.ReactNode
	loadingThumbnail?: ViewerLoadingThumbnail
}

const Overlay = ({
	loadingState,
	onLoaderFadeOutComplete,
	popover,
	animationControls,
	cameraControls,
	sceneViewReturn,
	loader,
	loadingThumbnail
}: OverlayProps) => {
	const showChrome = isViewerChromeVisible(loadingState)
	// Derived from the same predicate rather than restated, so the loader and
	// the chrome cannot both be on screen however that predicate changes.
	const showLoader = !showChrome
	const isLoaded = loadingState === 'loaded'

	return (
		<>
			{showLoader && loader && (
				<div
					className={cn(
						'vv:absolute vv:inset-0 vv:flex vv:h-full vv:w-full vv:flex-col vv:items-center vv:justify-center vv:gap-4 vv:transition-[opacity,filter] vv:ease-out',
						isLoaded
							? 'vv:pointer-events-none vv:opacity-0 vv:blur-[1px]'
							: 'vv:blur-none vv:opacity-100'
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
							'vv:relative vv:z-10 vv:transition-[opacity,transform] vv:duration-500 vv:ease-out',
							isLoaded
								? 'vv:translate-y-1 vv:opacity-0'
								: 'vv:translate-y-0 vv:opacity-100'
						)}
					>
						{loader}
					</div>
				</div>
			)}
			{/*
			  Gated, not merely ordered after the loader. DOM order never held
			  this: the popover root carries `z-[100]` and the loader layer is
			  `absolute inset-0` with no z-index of its own, so the popover won on
			  stacking whatever the source order was.
			*/}
			{showChrome && animationControls}
			{showChrome && cameraControls}
			{showChrome && sceneViewReturn}
			{showChrome && popover}
		</>
	)
}

export default Overlay
