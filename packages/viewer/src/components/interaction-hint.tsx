import { cn } from './class-names'

const classes = cn(
	'vctrl-viewer-interaction-hint shell-panel vv:pointer-events-none vv:absolute vv:top-1/2 vv:left-1/2 vv:max-w-[calc(100%-2rem)] vv:-translate-x-1/2 vv:-translate-y-1/2 vv:rounded-full vv:px-3 vv:py-1.5 vv:text-center vv:text-xs vv:text-muted-foreground',
	'vv:transition-opacity vv:duration-300 vv:ease-out vv:starting:opacity-0 vv:motion-reduce:transition-none'
)

/**
 * The first-time line telling a visitor how to move the scene.
 *
 * In the middle of the scene, the one place no chrome takes on any surface:
 * every edge and corner belongs to a control somewhere, and a line this wide
 * would cover one on a phone. Hidden from screen readers, which hear the same
 * keys in the viewer's own description. It fades in, and under reduced motion
 * simply appears.
 *
 * No z-index of its own, so it paints over the canvas and under the hotspot
 * markers and cards drei gives one. Two cases still land under it, for the
 * few seconds it shows and without taking their clicks: the farthest marker,
 * at drei's 0, and every marker during the canvas's opening fade, while the
 * canvas wrapper's opacity holds them in a stacking context of their own.
 */
const InteractionHint = ({ text }: { text: string }) => (
	<p className={classes} aria-hidden="true">
		{text}
	</p>
)

export default InteractionHint
