import { useViewerLoading } from '../hooks/use-viewer-loading'

import styles from './overlay.module.css'

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
					className={styles['loader-container']}
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
