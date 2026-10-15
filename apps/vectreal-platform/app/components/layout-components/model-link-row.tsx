import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import type { FC } from 'react'

interface Props {
	to: string
	/** A capture of the model on a transparent background. */
	previewUrl: string
	title: string
	/** One line under the title: what opening it costs and what it shows. */
	meta: string
	onClick?: () => void
	viewTransition?: boolean
	/**
	 * What the row sits on, so it lifts exactly one step off it: the page, or a
	 * `ds-raised` card such as the article's closing panel.
	 */
	surface?: 'page' | 'raised'
	className?: string
}

/**
 * One model to open, as a slim row: its picture at thumbnail size, and the
 * text beside it.
 *
 * The low-profile counterpart to `SampleTiles`, for a page whose main ask is
 * somewhere else and which offers a model as the shortcut beside it. Two large
 * tiles there read as a second, competing call to action.
 */
export const ModelLinkRow: FC<Props> = ({
	to,
	previewUrl,
	title,
	meta,
	onClick,
	viewTransition,
	surface = 'page',
	className
}) => (
	<Link
		to={to}
		onClick={onClick}
		viewTransition={viewTransition}
		className={cn(
			// A named group: the closing panel's Card is itself a `group`.
			'group/row inline-flex max-w-full min-w-0 items-center gap-3 rounded-xl py-1.5 pr-4 pl-1.5',
			surface === 'raised' ? 'ds-overlay-interactive' : 'ds-raised-interactive',
			className
		)}
	>
		{/*
		  `alt=""`: the link is named by the text beside it. Lazy, because it is
		  never what a page opens on.
		*/}
		<img
			src={previewUrl}
			alt=""
			loading="lazy"
			className="size-11 shrink-0 object-contain transition-transform duration-200 group-hover/row:scale-105 motion-reduce:transition-none"
		/>
		<span className="min-w-0">
			<span className="text-foreground text-body-sm block truncate font-medium">
				{title}
			</span>
			<span className="text-muted-foreground text-label-xs block truncate tabular-nums">
				{meta}
			</span>
		</span>
		<ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-hover/row:translate-x-0.5 motion-reduce:transition-none" />
	</Link>
)
