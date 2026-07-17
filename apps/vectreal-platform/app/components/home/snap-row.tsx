import { cn } from '@shared/utils'

import { useIOSSnapScrollFix } from '../../hooks/use-ios-snap-scroll-fix'

import type { PropsWithChildren, Ref } from 'react'

interface SnapRowProps extends PropsWithChildren {
	/** Element tag — `ul` for semantic lists of cards, `div` otherwise. */
	as?: 'div' | 'ul'
	/** Responsive grid classes applied from the breakpoint where the row stops scrolling and becomes a static grid. */
	gridClassName: string
	className?: string
}

/**
 * Mobile-only horizontal scroll-snap card row. Wraps `useIOSSnapScrollFix`
 * so iOS Safari's cached snap points stay in sync after ancestor reveal
 * animations, and defaults to `snap-mandatory` so every swipe — however
 * small — resolves to a clean card position.
 */
export function SnapRow({
	as: Tag = 'div',
	gridClassName,
	className,
	children
}: SnapRowProps) {
	const ref = useIOSSnapScrollFix<HTMLElement>()

	return (
		<Tag
			ref={ref as Ref<HTMLDivElement> & Ref<HTMLUListElement>}
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
