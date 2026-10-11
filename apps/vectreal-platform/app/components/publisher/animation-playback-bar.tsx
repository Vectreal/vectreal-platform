import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'

import { PUBLISHER_LAYER } from './shell/shell-layout'

interface AnimationPlaybackBarProps {
	visible: boolean
	playing: boolean
	onToggle: () => void
	onRestart: () => void
}

/**
 * The author's playback controls, on the stage.
 *
 * The publisher's own rather than the viewer's built-in ones: those belong to
 * the published scene, follow the author's "Visitor controls" setting, and sit
 * in the corner the publish card covers. These drive the same viewer commands
 * from the bottom-center slot the stage keeps for its controls, and show
 * whenever animation is on, whichever tool is open.
 */
const AnimationPlaybackBar = ({
	visible,
	playing,
	onToggle,
	onRestart
}: AnimationPlaybackBarProps) => (
	<AnimatePresence>
		{visible ? (
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
					'pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 sm:pr-66',
					'max-sm:top-17.5 max-sm:bottom-auto max-sm:justify-end',
					PUBLISHER_LAYER.animationControls
				)}
			>
				<div
					role="group"
					aria-label="Animation playback"
					className="publisher-shell-panel pointer-events-auto flex items-center gap-0.5 p-1"
				>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 rounded-lg"
						onClick={onToggle}
						aria-label={playing ? 'Pause animation' : 'Play animation'}
					>
						{playing ? <Pause /> : <Play />}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 rounded-lg"
						onClick={onRestart}
						aria-label="Restart animation"
					>
						<RotateCcw />
					</Button>
				</div>
			</motion.div>
		) : null}
	</AnimatePresence>
)

export default AnimationPlaybackBar
