import { CHROME_BUTTON } from './chrome-classes'
import { cn } from './class-names'
import { useViewerMessages } from './viewer-messages'

const classes = {
	root: 'vctrl-viewer-render-failure vv:absolute vv:inset-0 vv:flex vv:flex-col vv:items-center vv:justify-center vv:gap-3 vv:p-6 vv:text-center',
	message: 'vv:max-w-[32ch] vv:text-sm vv:text-muted-foreground',
	panel: 'shell-panel vv:p-1',
	button: cn(
		CHROME_BUTTON,
		'vv:h-7 vv:rounded-full vv:px-3 vv:text-xs vv:leading-none vv:font-medium'
	)
} as const

interface RenderFailureProps {
	onRetry: () => void
}

/**
 * Drawn in place of the canvas once the viewer has stopped trying to draw,
 * so a visitor sees why the scene is missing instead of an empty frame.
 *
 * `role="alert"` because it replaces content a visitor was waiting for, and
 * nothing else on screen announces that it is not coming.
 */
const RenderFailure = ({ onRetry }: RenderFailureProps) => {
	const messages = useViewerMessages()
	return (
		<div className={classes.root} role="alert">
			<p className={classes.message}>{messages.renderFailed}</p>
			<div className={classes.panel}>
				<button type="button" className={classes.button} onClick={onRetry}>
					{messages.tryAgain}
				</button>
			</div>
		</div>
	)
}

export default RenderFailure
