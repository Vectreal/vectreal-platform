import { cn } from '@shared/utils'

import type { ReactNode } from 'react'

/**
 * A labelled value on a sunken well.
 *
 * This shape existed eight times in the scene detail route alone - four in the
 * sidebar and four in the drawer that shows the same data on narrow screens -
 * and the two sets had drifted apart: the sidebar used `bg-background/70`, an
 * uppercase `text-[11px]` label and `mt-1` between label and value, the drawer
 * used `ds-overlay`, a sentence-case `text-xs` label and no gap. Same data,
 * same component, two typographies.
 */

interface StatTileProps {
	label: ReactNode
	value: ReactNode
	className?: string
	style?: React.CSSProperties
}

export function StatTile({ label, value, className, style }: StatTileProps) {
	return (
		<div className={cn('ds-sunken rounded-xl p-3', className)} style={style}>
			<p className="text-muted-foreground text-eyebrow">{label}</p>
			<p className="mt-1 font-medium">{value}</p>
		</div>
	)
}

interface StatGridProps {
	children: ReactNode
	className?: string
}

/** Two-column grid for `StatTile`. Wide tiles span it with `col-span-2`. */
export function StatGrid({ children, className }: StatGridProps) {
	return (
		<div className={cn('grid grid-cols-2 gap-2 text-sm', className)}>
			{children}
		</div>
	)
}
