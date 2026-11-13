import { CHROME_BUTTON } from './chrome-classes'
import { cn } from './class-names'

import type { InteractionInput } from './interaction-help'
import type { ViewerMessages } from '../locales/en'

/** What the start button and the way back say, for an input. */
export function tapToActivateWords(
	messages: ViewerMessages,
	input: InteractionInput
): { start: string; done: string; doneLabel: string } {
	return {
		start: input === 'touch' ? messages.tapToRotate : messages.clickToRotate,
		done: messages.doneRotating,
		doneLabel: messages.doneRotatingLabel
	}
}

const classes = {
	startRoot: cn(
		'vctrl-viewer-tap-to-activate shell-panel vv:absolute vv:top-1/2 vv:left-1/2 vv:z-[100] vv:max-w-[calc(100%-2rem)] vv:-translate-x-1/2 vv:-translate-y-1/2 vv:p-1',
		'vv:transition-opacity vv:duration-300 vv:ease-out vv:starting:opacity-0 vv:motion-reduce:transition-none'
	),
	start: cn(
		CHROME_BUTTON,
		'vv:rounded-full vv:px-4 vv:py-2 vv:text-sm vv:font-medium vv:text-foreground'
	),
	doneRoot: 'vctrl-viewer-tap-to-deactivate shell-panel vv:p-1',
	done: cn(
		CHROME_BUTTON,
		'vv:flex vv:h-7 vv:items-center vv:rounded-full vv:px-3 vv:py-0 vv:text-xs vv:leading-none vv:font-medium vv:whitespace-nowrap'
	)
} as const

/**
 * The one button a scene that waits for a tap shows: in the middle, over the
 * scene turning behind it. Nothing else in the viewer takes a touch until it
 * is pressed, so the page scrolls and a gallery swipes past the scene.
 */
export const TapToActivateButton = ({
	text,
	onActivate
}: {
	text: string
	onActivate: () => void
}) => (
	<div className={classes.startRoot}>
		<button type="button" className={classes.start} onClick={onActivate}>
			{text}
		</button>
	</div>
)

/**
 * The way back to scrolling once the scene took the touch, which a phone
 * otherwise has none of while the scene fills the screen.
 */
export const TapToDeactivateButton = ({
	text,
	label,
	onDeactivate
}: {
	text: string
	label: string
	onDeactivate: () => void
}) => (
	<div className={classes.doneRoot}>
		<button
			type="button"
			className={classes.done}
			onClick={onDeactivate}
			aria-label={label}
		>
			{text}
		</button>
	</div>
)
