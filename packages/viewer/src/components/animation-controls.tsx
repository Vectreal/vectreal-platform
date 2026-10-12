import { cn } from '@shared/utils'

import PauseIcon from './assets/pause-icon'
import PlayIcon from './assets/play-icon'
import RestartIcon from './assets/restart-icon'
import { CHROME_BUTTON } from './chrome-classes'

export interface AnimationControlsProps {
	playing: boolean
	/** True once the program has run to its end without looping. */
	complete: boolean
	onToggle: () => void
	onRestart: () => void
	className?: string
}

const controlClasses = {
	root: 'vctrl-viewer-animation-controls shell-panel flex items-center gap-0.5 p-1',
	button: cn(
		CHROME_BUTTON,
		'flex h-7 w-7 items-center justify-center rounded-full p-0 leading-none'
	),
	icon: 'h-3.5 w-3.5'
} as const

/**
 * Playback controls for the end viewer.
 *
 * Rendered only when the scene author opts in, and deliberately limited to two
 * actions. There is no scrubber: with several clips of differing duration and
 * rate, and a sequence whose total length depends on repeat counts, a single
 * global position has no well-defined mapping onto clip times. The authoring
 * panel gets a scrubber instead, where exactly one clip is in scope at a time.
 *
 * Restart is always present because in simultaneous mode there is no other way
 * back to the beginning once a program has run out.
 *
 * The bar alone, placed by whoever draws it: the viewer puts it bottom-right,
 * clear of its info popover, and the Publisher at the foot of its stage.
 */
const AnimationControls = ({
	playing,
	complete,
	onToggle,
	onRestart,
	className
}: AnimationControlsProps) => (
	<div
		className={cn(controlClasses.root, className)}
		role="group"
		aria-label="Animation playback"
	>
		<button
			type="button"
			className={controlClasses.button}
			onClick={onToggle}
			aria-label={playing ? 'Pause animation' : 'Play animation'}
		>
			{playing ? (
				<PauseIcon className={controlClasses.icon} />
			) : (
				<PlayIcon className={controlClasses.icon} />
			)}
		</button>
		<button
			type="button"
			className={controlClasses.button}
			onClick={onRestart}
			aria-label="Restart animation"
			data-complete={complete || undefined}
		>
			<RestartIcon className={controlClasses.icon} />
		</button>
	</div>
)

export default AnimationControls
