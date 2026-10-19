import { cn } from '../class-names'

import type { HotspotPopoverContent } from './resolve-hotspot-popover'
import type { HotspotPopoverPlacement } from './resolve-hotspot-popover'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'

const popoverClasses = {
	root: 'vctrl-hotspot-popover shell-panel vv:text-foreground vv:pointer-events-auto vv:absolute vv:left-1/2 vv:w-max vv:max-w-[240px] vv:px-3 vv:py-2 vv:text-left',
	above: 'vv:bottom-[var(--vctrl-hotspot-popover-gap)]',
	below: 'vv:top-[var(--vctrl-hotspot-popover-gap)]',
	title: 'vv:text-[12px] vv:leading-[1.35] vv:font-[600]',
	// `whitespace-pre-wrap` so the line breaks an author typed survive. The body
	// is plain text, never markup, so this is the only formatting it carries.
	body: 'vv:mt-1 vv:text-[11px] vv:leading-[1.5] vv:whitespace-pre-wrap vv:opacity-90',
	link: 'vv:mt-2 vv:inline-block vv:max-w-full vv:truncate vv:text-[11px] vv:leading-[1.5] vv:underline vv:underline-offset-2 vv:opacity-90 vv:hover:opacity-100'
} as const

export interface HotspotPopoverProps {
	/** Heads the card. The marker's own name, so the two cannot drift apart. */
	title: string
	content: HotspotPopoverContent
	/** Names the card from the marker's `aria-controls`. */
	id: string
	/** Where to draw it, decided by the marker. See below. */
	placement: HotspotPopoverPlacement
	/** Clearance from the marker's centre, in pixels. */
	gap: number
	/** The marker measures this element to decide the placement. */
	cardRef: RefObject<HTMLDivElement | null>
	/**
	 * Escape, handled here as well as on the marker.
	 *
	 * Both are needed, and not by accident: this card is rendered into a drei
	 * `Html`, which mounts its children in a ReactDOM root of its own. A React
	 * event handler on the marker's tree therefore never sees a key pressed
	 * inside the card, because the two are separate roots over separate DOM
	 * subtrees.
	 */
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/**
 * What a marker says when a visitor opens it. Presentational only.
 *
 * Every decision reaches it as a prop, and that is a hard constraint rather
 * than a preference: drei's `Html` renders its children through
 * `ReactDOM.createRoot`, so this component sits in a React root that inherits
 * no context from the canvas. `useThree` and `useFrame` here would not merely
 * misbehave - they throw "Hooks can only be used within the Canvas component",
 * and the failing root empties its own container, so the marker itself
 * disappears rather than just the card. `HotspotMarker` does the measuring,
 * because it is in the R3F tree.
 *
 * Non-modal by design: no focus trap and no scroll lock, because the visitor
 * has to be able to keep orbiting the model and reach the other markers while
 * this is open. `info-popover.tsx`'s document-global trap is the right shape
 * for a chrome panel and the wrong one here.
 */
const HotspotPopover = ({
	title,
	content,
	id,
	placement,
	gap,
	cardRef,
	onKeyDown
}: HotspotPopoverProps) => (
	<div
		ref={cardRef}
		id={id}
		className={cn(popoverClasses.root, popoverClasses[placement.side])}
		// Read by the stylesheet, which owns the transform so the entry
		// animation can reuse the same X and move nothing but opacity and Y.
		data-side={placement.side}
		onKeyDown={onKeyDown}
		style={
			{
				'--vctrl-hotspot-popover-gap': `${gap}px`,
				'--vctrl-hotspot-popover-shift': `calc(-50% + ${placement.offsetX}px)`
			} as CSSProperties
		}
	>
		<p className={popoverClasses.title}>{title}</p>
		{content.body && <p className={popoverClasses.body}>{content.body}</p>}
		{content.link && (
			<a
				className={popoverClasses.link}
				href={content.link.href}
				target="_blank"
				// `noopener` is the one that matters - it denies the opened page a
				// handle on this one, which for an embedded viewer is somebody
				// else's page. `noreferrer` follows it because a target of `_blank`
				// implies opener in older engines that do not honour the first.
				rel="noopener noreferrer"
			>
				{content.link.label}
			</a>
		)}
	</div>
)

export default HotspotPopover
