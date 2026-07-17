import { cn } from '@shared/utils'

import type { PropsWithChildren } from 'react'

interface SnapRowProps extends PropsWithChildren {
	/** Element tag — `ul` for semantic lists of cards, `div` otherwise. */
	as?: 'div' | 'ul'
	/** Responsive grid classes applied from the breakpoint where the row stops scrolling and becomes a static grid. */
	gridClassName: string
	className?: string
}

/**
 * Mobile-only horizontal scroll-snap card row. `snap-mandatory` (not
 * `snap-proximity`) so every swipe, however small, resolves to a clean
 * card position, with `scroll-pl-6` aligning the snap target to the row's
 * own edge padding.
 */
export function SnapRow({
	as: Tag = 'div',
	gridClassName,
	className,
	children
}: SnapRowProps) {
	return (
		<Tag
			style={{ WebkitOverflowScrolling: 'touch' }}
			className={cn(
				'no-scrollbar -mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-pl-6 px-6 pb-1',
				gridClassName,
				className
			)}
		>
			{children}
		</Tag>
	)
}
