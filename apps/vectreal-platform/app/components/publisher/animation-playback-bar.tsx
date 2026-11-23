import { cn } from '@shared/utils'
import { AnimationControls } from '@vctrl/viewer'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'

import {
	PUBLISHER_BESIDE_TOOL_PANEL,
	PUBLISHER_LAYER
} from './shell/shell-layout'
import { toolSidebarStateAtom } from '../../lib/stores/publisher-config-store'

interface AnimationPlaybackBarProps {
	visible: boolean
	playing: boolean
	complete: boolean
	onToggle: () => void
	onRestart: () => void
	/** One line above the controls, shown even while they are hidden. */
	note?: string
}

/**
 * The author's playback controls, on the stage.
 *
 * The viewer's own `AnimationControls`, so the editor and preview draw one
 * bar. Placed by the stage rather than the viewer: the viewer's built-in copy
 * belongs to the published scene, follows the author's "Visitor controls"
 * setting, and sits in the corner the publish card covers. This one drives the
 * same commands from the bottom-center slot the stage keeps for its controls,
 * and shows whenever animation is on, whichever tool is open. Its note says
 * what the animation changes on stage, such as a studio finish held back.
 */
const AnimationPlaybackBar = ({
	visible,
	playing,
	complete,
	onToggle,
	onRestart,
	note
}: AnimationPlaybackBarProps) => {
	const { showSidebar } = useAtomValue(toolSidebarStateAtom)
	return (
		<AnimatePresence>
			{visible || note ? (
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{ type: 'spring', stiffness: 320, damping: 28 }}
					className={cn(
						// Centered in the stage left of the publish card's column (w-60
						// plus its inset and a gap), which stays on stage in the editor.
						// A phone has no room for both in the bottom row, so there the
						// bar takes the free corner under the tool bar instead.
						'pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-3 sm:pr-66',
						'max-sm:top-17.5 max-sm:bottom-auto max-sm:items-end',
						// Centered in the stage the open tool panel leaves free.
						showSidebar && PUBLISHER_BESIDE_TOOL_PANEL,
						PUBLISHER_LAYER.animationControls
					)}
				>
					{note && (
						<p
							role="status"
							// Wraps rather than running under the panel on a narrow stage.
							className="ds-overlay max-w-full rounded-2xl px-3 py-1 text-center text-xs font-medium text-balance"
						>
							{note}
						</p>
					)}
					{visible && (
						<AnimationControls
							className="pointer-events-auto"
							playing={playing}
							complete={complete}
							onToggle={onToggle}
							onRestart={onRestart}
						/>
					)}
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}

export default AnimationPlaybackBar
