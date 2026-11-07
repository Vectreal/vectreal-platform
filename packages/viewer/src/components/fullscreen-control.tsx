import { useEffect, useState } from 'react'

import EnterFullscreenIcon from './assets/enter-fullscreen-icon'
import ExitFullscreenIcon from './assets/exit-fullscreen-icon'
import { CHROME_BUTTON } from './chrome-classes'
import { cn, withHostClasses } from './class-names'

export interface FullscreenControlProps {
	/** The element shown full screen: the viewer's own container. */
	target: HTMLElement | null
	className?: string
}

const classes = {
	root: 'vctrl-viewer-fullscreen-control shell-panel vv:p-1',
	button: cn(
		CHROME_BUTTON,
		'vv:flex vv:h-7 vv:w-7 vv:items-center vv:justify-center vv:rounded-full vv:p-0 vv:leading-none'
	),
	icon: 'vv:h-3.5 vv:w-3.5'
} as const

/**
 * Shows the viewer full screen, and back.
 *
 * Draws nothing where the browser will not allow it: an iframe without
 * `allowfullscreen`, or an iPhone, whose Safari takes only video full screen.
 * Read after mount, so the server never draws a button the browser refuses.
 * Escape leaves full screen on its own; the browser handles that key.
 */
const FullscreenControl = ({ target, className }: FullscreenControlProps) => {
	const [supported, setSupported] = useState(false)
	const [isFullscreen, setIsFullscreen] = useState(false)

	useEffect(() => {
		if (!target) return
		setSupported(
			document.fullscreenEnabled &&
				typeof target.requestFullscreen === 'function'
		)
		const sync = () => setIsFullscreen(document.fullscreenElement === target)
		sync()
		document.addEventListener('fullscreenchange', sync)
		return () => document.removeEventListener('fullscreenchange', sync)
	}, [target])

	if (!supported || !target) return null

	const toggle = () => {
		if (isFullscreen) void document.exitFullscreen()
		else void target.requestFullscreen()
	}

	return (
		<div className={withHostClasses(classes.root, className)}>
			<button
				type="button"
				className={classes.button}
				onClick={toggle}
				aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
			>
				{isFullscreen ? (
					<ExitFullscreenIcon className={classes.icon} />
				) : (
					<EnterFullscreenIcon className={classes.icon} />
				)}
			</button>
		</div>
	)
}

export default FullscreenControl
