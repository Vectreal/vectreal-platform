import { cn } from '@shared/utils'

import type { HotspotPopoverContent } from './resolve-hotspot-popover'
import type { HotspotPopoverPlacement } from './resolve-hotspot-popover'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'

const popoverClasses = {
	// `rounded-[0.5rem]`, never a named radius: this package clears Tailwind's
	// radius namespace, so every named token but `full` compiles to nothing once
	// the package is consumed from npm.
	root: 'vctrl-hotspot-popover pointer-events-auto absolute left-1/2 w-max max-w-[240px] rounded-[0.5rem] bg-[var(--vctrl-bg)] px-3 py-2 text-left text-[var(--vctrl-text)] shadow-[0_2px_12px_rgba(0,0,0,0.35)]',
	above: 'bottom-[var(--vctrl-hotspot-popover-gap)]',
	below: 'top-[var(--vctrl-hotspot-popover-gap)]',
	// `font-[600]` rather than the named scale: a named weight registers its
	// theme variable in the published stylesheet's `:root, :host` block, which
	// lands in a host application after hydration. See styles.css.
	title: 'text-[12px] leading-[1.35] font-[600]',
	// `whitespace-pre-wrap` so the line breaks an author typed survive. The body
	// is plain text, never markup, so this is the only formatting it carries.
	body: 'mt-1 text-[11px] leading-[1.5] whitespace-pre-wrap opacity-90',
	link: 'mt-2 inline-block max-w-full truncate text-[11px] leading-[1.5] underline underline-offset-2 opacity-90 hover:opacity-100'
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
