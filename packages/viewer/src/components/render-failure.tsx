import { CHROME_BUTTON } from './chrome-classes'
import { cn } from './class-names'

/** Every word the failure state says, so a copy change is one edit here. */
export const RENDER_FAILURE_COPY = {
	message: "This scene couldn't be shown on this device.",
	retry: 'Try again'
} as const

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
const RenderFailure = ({ onRetry }: RenderFailureProps) => (
	<div className={classes.root} role="alert">
		<p className={classes.message}>{RENDER_FAILURE_COPY.message}</p>
		<div className={classes.panel}>
			<button type="button" className={classes.button} onClick={onRetry}>
				{RENDER_FAILURE_COPY.retry}
			</button>
		</div>
	</div>
)

export default RenderFailure
