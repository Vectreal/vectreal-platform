import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { cn } from '@shared/utils'
import { Ellipsis } from 'lucide-react'
import { Link, type To } from 'react-router'

import { SceneThumbnail } from './scene-thumbnail'

import type { ReactNode } from 'react'

/**
 * A thing you can see and click into, at a glance.
 *
 * Projects and scenes are different entities and the same card: a picture of
 * it, what it is called, where it lives, one line of state, when it last moved,
 * and a menu. The middle differs - a project shows how its scenes divide, a
 * scene shows its own status - and everything around it does not.
 *
 * Extracted at the second instance rather than the third, because the parts
 * that would drift are the ones nobody would notice drifting: the menu trigger
 * carries two fixes that cost real time and are invisible until they are gone.
 */

interface EntityCardProps {
	to: To
	title: string
	/** Where it lives: the organization for a project, the project for a scene. */
	subtitle?: ReactNode
	thumbnailUrl?: null | string
	/** One line of state, under the title. */
	status?: ReactNode
	/** The quiet line at the foot, usually a date. */
	footer?: ReactNode
	/**
	 * Items for the actions menu. Omit and no menu is rendered at all - the
	 * trigger belongs to this component so its two fixes stay in one place.
	 */
	menuItems?: ReactNode
	className?: string
}

export function EntityCard({
	to,
	title,
	subtitle,
	thumbnailUrl,
	status,
	footer,
	menuItems,
	className
}: EntityCardProps) {
	return (
		<div className={cn('group/card relative', className)}>
			<Link
				to={to}
				viewTransition
				className="ds-raised-interactive block overflow-hidden rounded-2xl"
			>
				<SceneThumbnail src={thumbnailUrl} className="rounded-none" />

				<div className="space-y-3 p-5">
					<div className="min-w-0">
						<p className="truncate font-medium">{title}</p>
						{subtitle ? (
							<p className="text-muted-foreground truncate text-xs">
								{subtitle}
							</p>
						) : null}
					</div>

					{/*
					  State and date share a row. They are the two secondary facts on
					  the card and each held a line of its own, which gave the pair
					  twice the vertical weight of the name - the thing being scanned
					  for. Side by side they read as one caption under the title.
					*/}
					{status || footer ? (
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">{status}</div>
							{footer ? (
								<p className="text-muted-foreground text-label-xs shrink-0">
									{footer}
								</p>
							) : null}
						</div>
					) : null}
				</div>
			</Link>

			{/*
			  Outside the card link rather than inside it: nesting an anchor in an
			  anchor is invalid, and the browser resolves it by dropping one of them.
			*/}
			{menuItems ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							/*
							  Never `disabled` until hydration, the way the table's action
							  cells are. `Button` renders `disabled` as
							  `pointer-events: none`, and this trigger is a sibling laid
							  over a link that fills the whole card - so a disabled one
							  does not merely fail to open the menu, it hands the tap to
							  the card and navigates. Enabled, it absorbs the tap and does
							  nothing until its handler is attached, which is what every
							  control on a hydrating page does anyway.
							*/
							aria-label={`Actions for ${title}`}
							/*
							  Always present, on its own scrim. This used to be `opacity-0`
							  until hover, sitting bare on the thumbnail - against a light
							  image it was invisible even while hovered, and hover-reveal has
							  no touch equivalent, so on a tablet the menu was unreachable.
							*/
							className="bg-background/70 hover:bg-background focus-visible:bg-background data-[state=open]:bg-background absolute top-2 right-2 backdrop-blur-sm transition-colors"
						>
							<Ellipsis className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	)
}
