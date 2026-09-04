import { useFrame, useThree } from '@react-three/fiber'
import { cn } from '@shared/utils'
import { useRef, useState } from 'react'

import { resolveHotspotPopoverPlacement } from './resolve-hotspot-popover'

import type {
	HotspotPopoverContent,
	HotspotPopoverPlacement
} from './resolve-hotspot-popover'
import type { CSSProperties } from 'react'

/**
 * Clearance between the marker's centre and the popover's near edge, and
 * between the popover and the edge of the canvas.
 *
 * The gap clears the 24px marker box plus a little air; the margin is what
 * stops a card from sitting flush against the canvas edge, where it reads as
 * clipped whether or not it is.
 */
const ANCHOR_GAP_PX = 20
const CANVAS_MARGIN_PX = 8

/**
 * How often the placement is re-decided while the popover is open, in seconds.
 *
 * The card follows its marker for free - it is inside the same portal - so this
 * only has to catch the marker crossing an edge as the camera moves. Two
 * `getBoundingClientRect` calls at 10Hz, for at most one open popover.
 */
const PLACEMENT_INTERVAL_SECONDS = 0.1

const DEFAULT_PLACEMENT: HotspotPopoverPlacement = {
	side: 'above',
	offsetX: 0
}

const popoverClasses = {
	// `rounded-[0.5rem]`, never a named radius: this package clears Tailwind's
	// radius namespace, so every named token but `full` compiles to nothing once
	// the package is consumed from npm.
	root: 'vctrl-hotspot-popover pointer-events-auto absolute left-1/2 w-max max-w-[240px] rounded-[0.5rem] bg-[var(--vctrl-bg)] px-3 py-2 text-left text-[var(--vctrl-text)] shadow-[0_2px_12px_rgba(0,0,0,0.35)]',
	above: 'bottom-[calc(100%+var(--vctrl-hotspot-popover-gap))]',
	below: 'top-[calc(100%+var(--vctrl-hotspot-popover-gap))]',
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
	/** The marker root, which the card is placed against. */
	anchorRef: React.RefObject<HTMLDivElement | null>
}

/**
 * What a marker says when a visitor opens it.
 *
 * Non-modal by design: no focus trap and no scroll lock, because the visitor
 * has to be able to keep orbiting the model and reach the other markers while
 * this is open. `info-popover.tsx`'s document-global trap is the right shape
 * for a chrome panel and the wrong one here.
 *
 * Placement is re-decided from the canvas box rather than fixed, so a marker
 * near the top of the frame flips its card below instead of drawing it off the
 * viewport - which is also what the hover label does not do yet.
 */
const HotspotPopover = ({
	title,
	content,
	id,
	anchorRef
}: HotspotPopoverProps) => {
	const canvas = useThree((state) => state.gl.domElement)
	const cardRef = useRef<HTMLDivElement>(null)
	// Seeded at the interval so the very first frame measures rather than
	// waiting one out. Under `frameloop="demand"` that first frame is the only
	// one the card is guaranteed, and until it runs the placement is the default
	// rather than the measured answer.
	const elapsed = useRef(PLACEMENT_INTERVAL_SECONDS)
	const [placement, setPlacement] =
		useState<HotspotPopoverPlacement>(DEFAULT_PLACEMENT)

	useFrame((_state, delta) => {
		elapsed.current += delta
		if (elapsed.current < PLACEMENT_INTERVAL_SECONDS) return
		elapsed.current = 0

		const anchor = anchorRef.current
		const card = cardRef.current
		if (!anchor || !card) return

		const anchorBox = anchor.getBoundingClientRect()
		const canvasBox = canvas.getBoundingClientRect()

		const next = resolveHotspotPopoverPlacement({
			anchor: {
				x: anchorBox.left + anchorBox.width / 2 - canvasBox.left,
				y: anchorBox.top + anchorBox.height / 2 - canvasBox.top
			},
			size: { width: card.offsetWidth, height: card.offsetHeight },
			bounds: { width: canvasBox.width, height: canvasBox.height },
			gap: ANCHOR_GAP_PX,
			margin: CANVAS_MARGIN_PX
		})

		// One state write only when the answer moved: this runs in the frame
		// loop, where an unconditional write would re-render the marker's portal
		// ten times a second for as long as the card is open.
		setPlacement((previous) =>
			previous.side === next.side && previous.offsetX === next.offsetX
				? previous
				: next
		)
	})

	return (
		<div
			ref={cardRef}
			id={id}
			className={cn(popoverClasses.root, popoverClasses[placement.side])}
			// Read by the stylesheet, which owns the transform so the entry
			// animation can reuse the same X and move nothing but opacity and Y.
			data-side={placement.side}
			style={
				{
					'--vctrl-hotspot-popover-gap': `${ANCHOR_GAP_PX}px`,
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
}

export default HotspotPopover
