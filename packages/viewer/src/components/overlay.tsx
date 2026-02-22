import { cn } from '@shared/utils'

import { useViewerLoading } from '../hooks/use-viewer-loading'

interface OverlayProps {
	hasContent: boolean
	popover?: React.ReactNode
	loader?: React.ReactNode
}

const Overlay = ({ hasContent, popover, loader }: OverlayProps) => {
	const loadingState = useViewerLoading(hasContent)
	const showLoader = loadingState !== 'ready'

	return (
		<>
			{showLoader && loader && (
				<div
					className={cn(
						'absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 opacity-100 transition-opacity duration-500 ease-in-out',
						loadingState === 'loaded' && 'pointer-events-none opacity-0'
					)}
					data-loading-state={loadingState}
				>
					{loader}
				</div>
			)}
			{popover}
		</>
	)
}

export default Overlay
