import { cn } from '@shared/utils'

import LoadingShadowPlane from './loading-shadow-plane'
import LoadingThumbnailBackdrop from './loading-thumbnail-backdrop'
import { useViewerLoading } from '../hooks/use-viewer-loading'

import type { ViewerLoadingThumbnail } from '../types/viewer-types'

interface OverlayProps {
	hasContent: boolean
	popover?: React.ReactNode
	loader?: React.ReactNode
	loadingThumbnail?: ViewerLoadingThumbnail
}

const Overlay = ({
	hasContent,
	popover,
	loader,
	loadingThumbnail
}: OverlayProps) => {
	const loadingState = useViewerLoading(hasContent)
	const showLoader = loadingState !== 'ready'
	const isLoaded = loadingState === 'loaded'

	return (
		<>
			{showLoader && loader && (
				<div
					className={cn(
						'absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 transition-[opacity,filter] duration-700 ease-out',
						isLoaded
							? 'pointer-events-none opacity-0 blur-[1px]'
							: 'blur-0 opacity-100'
					)}
					data-loading-state={loadingState}
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
