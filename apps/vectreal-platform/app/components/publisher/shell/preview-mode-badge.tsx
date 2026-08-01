import { cn } from '@shared/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAtom, useSetAtom } from 'jotai/react'
import { useCallback } from 'react'

import { PUBLISHER_EDGE_INSET, PUBLISHER_LAYER } from './shell-layout'
import {
	isPreviewModeAtom,
	processAtom
} from '../../../lib/stores/publisher-config-store'
import PreviewExitBadge from '../../scene-embed/preview-chrome/preview-exit-badge'

/**
 * Preview mode, shown rather than explained.
 *
 * Entering preview used to be announced by an amber paragraph in a sidebar that
 * preview mode itself had just closed. The state is now carried by the canvas:
 * the editing chrome recedes, and one labelled pill says where you are and how
 * to leave.
 *
 * It sits top-left, taking the place the tool rail just vacated. The nav cube
 * owns bottom-left and the camera controls own bottom-center, so this is the
 * only edge position that collides with nothing.
 *
 * Rendered here rather than beside the camera controls because it has to exist
 * even when a scene has no cameras — otherwise preview mode has no exit at all
 * once the sidebar closes.
 */
export const PreviewModeBadge = () => {
	const [isPreviewMode, setIsPreviewMode] = useAtom(isPreviewModeAtom)
	const setProcessState = useSetAtom(processAtom)
	const prefersReducedMotion = useReducedMotion()

	const handleExitPreviewMode = useCallback(() => {
		setIsPreviewMode(false)
		setProcessState((prev) => ({
			...prev,
			mode: 'compose',
			activeComposeTool: 'camera-controls',
			showSidebar: true,
			showPublishPanel: false
		}))
	}, [setIsPreviewMode, setProcessState])

	const offset = prefersReducedMotion ? 0 : -8
	const transition = prefersReducedMotion
		? { duration: 0 }
		: { duration: 0.24, ease: [0.4, 0, 0.2, 1] as const }

	return (
		<AnimatePresence>
			{isPreviewMode ? (
				<motion.div
					initial={{ opacity: 0, y: offset }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: offset }}
					transition={transition}
					className={cn(
						'absolute top-0 left-0',
						PUBLISHER_EDGE_INSET,
						PUBLISHER_LAYER.previewControls
					)}
				>
					<PreviewExitBadge
						exitLabel="Exit preview mode"
						onExit={handleExitPreviewMode}
					/>
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}

export default PreviewModeBadge
