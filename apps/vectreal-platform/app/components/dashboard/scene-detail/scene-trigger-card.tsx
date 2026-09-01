import { cn } from '@shared/utils'
import { ChevronRight } from 'lucide-react'

import type { ReactNode, Ref } from 'react'

interface SceneTriggerCardProps {
	/** What is behind the door. */
	label: string
	/** One line saying what it currently holds, so the card is worth its space. */
	summary: ReactNode
	className?: string
	/** Supplied by `DrawerTrigger asChild`; never set by hand. */
	ref?: Ref<HTMLButtonElement>
}

/**
 * A door, drawn so it reads as one.
 *
 * The scene detail aside is made of two kinds of thing: surfaces that state a
 * fact, and surfaces that open something. Before this, the second kind was a
 * `Button` in the header's action stack, which made "Publish & Embed" the fourth
 * call to action on a page whose actual actions are Preview and Open in
 * Publisher - and gave no clue what was behind it.
 *
 * `ds-overlay-interactive` rather than a hand-written hover: it lifts exactly
 * one step from the raised panel these sit on, which is the ladder's own rule
 * for a row hovered on top of raised.
 *
 * The summary is the point. A door labelled only "Publish & Embed" is a fourth
 * button wearing a card; one that says `Published · 27 Aug` has already answered
 * the question most visits are here to ask.
 */
export function SceneTriggerCard({
	label,
	summary,
	className,
	ref,
	...props
}: SceneTriggerCardProps & React.ComponentProps<'button'>) {
	return (
		<button
			ref={ref}
			type="button"
			className={cn(
				'ds-overlay-interactive group flex w-full items-center gap-3 rounded-xl p-3 text-left',
				className
			)}
			{...props}
		>
			<span className="min-w-0 flex-1">
				<span className="text-foreground block text-sm font-medium">
					{label}
				</span>
				{/*
				  `block` and `truncate`: a published timestamp is short, but the asset
				  summary is a count plus a size and this card is 26rem at its widest
				  and a phone at its narrowest.
				*/}
				<span className="text-muted-foreground block truncate text-xs">
					{summary}
				</span>
			</span>
			{/*
			  150ms, the scale's fast step, and stilled under `prefers-reduced-motion`.
			  The nudge says "this opens something" on hover; it is not decoration,
			  but it is also not worth overriding someone's stated preference for.
			*/}
			<ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
		</button>
	)
}
