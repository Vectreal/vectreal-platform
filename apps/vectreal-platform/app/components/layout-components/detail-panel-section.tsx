import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'

import type { ReactNode } from 'react'

/**
 * One titled block inside a detail panel.
 *
 * Two hand-rolled halves of one idea. `scene.tsx` drew the surface itself at
 * four raised panels - `ds-raised … rounded-2xl p-5`, no two of them spelled
 * quite the same - and wrote the heading rung at the plain sections below them, as
 * `text-h4` on whichever element the author reached for: `h2` at the page
 * level, `h3` in the drawer, `h4` once inside another section. The publisher
 * had its own copy of the rung in `SidebarSection`. Nothing owned either half,
 * so nothing could correct them.
 *
 * `text-h4` is the rung a section heading sits on inside a panel. The surface's
 * own title is the level above it - `DrawerTitle` in the drawer, the header
 * `DynamicSidebar` renders for the publisher panel - which is why the default
 * here is `h3`. `headingLevel` sets the element for the two cases the default
 * gets wrong: a section nested inside another section, and a section on a page
 * that renders no title above it at all. It moves the element, never the type
 * scale.
 *
 * `surface="raised"` is for a section that has to draw its own panel, sitting
 * directly on the page. Inside a panel that is already raised, leave it plain:
 * the ladder steps up on nesting, and a raised block inside a raised drawer
 * reads as a second frame around content that needed none.
 */

interface DetailPanelSectionProps {
	/** Kicker above the heading, on the `text-eyebrow` rung. */
	eyebrow?: ReactNode
	title?: ReactNode
	description?: ReactNode
	/** Trailing control on the heading row: a tooltip, a small button. */
	action?: ReactNode
	/** Only where the surrounding document outline needs a different level. */
	headingLevel?: 'h2' | 'h3' | 'h4'
	surface?: 'plain' | 'raised'
	/** Rule between the heading and the content. */
	divider?: boolean
	className?: string
	/**
	 * Spacing between the children, when the default rhythm is wrong.
	 *
	 * `className` styles the section; the children sit in a wrapper of their
	 * own, so a layout class meant for them belongs here.
	 */
	contentClassName?: string
	children?: ReactNode
}

export function DetailPanelSection({
	eyebrow,
	title,
	description,
	action,
	headingLevel: Heading = 'h3',
	surface = 'plain',
	divider = false,
	className,
	contentClassName,
	children
}: DetailPanelSectionProps) {
	const hasHeader = Boolean(eyebrow || title || description || action)

	return (
		<section
			className={cn(
				'space-y-3',
				surface === 'raised' && 'ds-raised rounded-2xl p-5',
				className
			)}
		>
			{hasHeader && (
				<div className="space-y-1">
					{eyebrow && (
						<p className="text-muted-foreground text-eyebrow">{eyebrow}</p>
					)}
					<div className="flex items-center justify-between gap-2">
						{title && (
							<Heading className="text-foreground text-h4">{title}</Heading>
						)}
						{action}
					</div>
					{description && (
						<p className="text-muted-foreground text-sm">{description}</p>
					)}
				</div>
			)}

			{divider && <Separator />}

			{children && (
				<div className={cn('space-y-3', contentClassName)}>{children}</div>
			)}
		</section>
	)
}
