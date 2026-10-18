import { cn } from '@shared/utils'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const SIZES = {
	page: {
		root: 'gap-4 rounded-2xl p-6',
		tile: 'size-10 rounded-xl [&_svg]:size-5',
		title: 'text-h4',
		actions: 'mt-4'
	},
	inline: {
		root: 'gap-3 rounded-xl p-4',
		tile: 'size-8 rounded-lg [&_svg]:size-4',
		title: 'text-body-sm font-medium',
		actions: 'mt-3'
	}
} as const

/*
  The well and the icon tile, per surface system. On the app's `ds-*` ladder a
  page-size state is a raised panel and an inline one a sunken well, with the
  tile one step up from either. The publisher shell mixes against transparent
  instead, so a `shell-nested` tile on a `shell-nested` well steps up by itself.
*/
const SURFACES = {
	ladder: {
		page: 'ds-raised',
		inline: 'ds-sunken',
		tile: 'ds-raised'
	},
	shell: {
		page: 'shell-nested',
		inline: 'shell-nested',
		tile: 'shell-nested'
	}
} as const

interface EmptyStateProps {
	icon: LucideIcon
	/** Names the space and what belongs in it, not that it is empty. */
	title: ReactNode
	description?: ReactNode
	/** The next step: one primary control, optionally a quieter one beside it. */
	action?: ReactNode
	/**
	 * `page` sits directly on a page and draws its own panel. `inline` sits
	 * inside a panel, a table or a sidebar and recedes into it.
	 */
	size?: keyof typeof SIZES
	/** `shell` inside the publisher, whose panels use their own recipe. */
	surface?: keyof typeof SURFACES
	/**
	 * The title's element. A page-size state is a section of the page, so an
	 * `h2` by default; an inline one is a line inside someone else's section,
	 * so a paragraph unless the caller says otherwise.
	 */
	headingLevel?: 'h2' | 'h3' | 'h4' | 'p'
	/** Placement only: margins, width. */
	className?: string
}

/**
 * What a region shows when it has nothing in it yet.
 *
 * There were nine of these and no two agreed: the shadcn `Empty` primitive used
 * three ways (an icon tile with a title, a bare header standing in for the
 * title, a 96px icon), and four regions drew their own, from a centred raised
 * card to a single muted table cell. This is the one shape now: left-aligned,
 * an icon tile one step above its well, a title that says what belongs here,
 * one sentence, and the action that fills it.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	size = 'page',
	surface = 'ladder',
	headingLevel,
	className
}: EmptyStateProps) {
	const styles = SIZES[size]
	const surfaces = SURFACES[surface]
	const Heading = headingLevel ?? (size === 'page' ? 'h2' : 'p')

	return (
		<div
			className={cn('flex items-start', surfaces[size], styles.root, className)}
		>
			<div
				className={cn(
					'text-foreground flex shrink-0 items-center justify-center',
					surfaces.tile,
					styles.tile
				)}
			>
				<Icon aria-hidden />
			</div>
			<div className="min-w-0 flex-1">
				<Heading className={styles.title}>{title}</Heading>
				{description && (
					<div className="text-muted-foreground text-body-sm mt-1 max-w-prose">
						{description}
					</div>
				)}
				{action && (
					<div
						className={cn('flex flex-wrap items-center gap-3', styles.actions)}
					>
						{action}
					</div>
				)}
			</div>
		</div>
	)
}
