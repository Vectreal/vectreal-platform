import { cn } from '@shared/utils'

import type { ComponentProps, ReactNode } from 'react'

interface PanelRowButtonProps extends Omit<ComponentProps<'button'>, 'type'> {
	label: string
	icon?: ReactNode
	/** The row's current state in a word or two, such as "Studio" or "3". */
	summary?: ReactNode
	/** Where the row leads: a chevron into a view, an arrow out to a drawer. */
	trailingIcon: ReactNode
}

/**
 * One full-width row in a publisher panel that leads somewhere else. A flat
 * `ds-field-interactive` row rather than a card, so panels never nest one
 * elevated surface in another.
 */
export function PanelRowButton({
	label,
	icon,
	summary,
	trailingIcon,
	className,
	...props
}: PanelRowButtonProps) {
	return (
		<button
			type="button"
			className={cn(
				'publisher-shell-focus ds-field-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium',
				'disabled:pointer-events-none disabled:opacity-50',
				'[&>svg:last-child]:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0',
				className
			)}
			{...props}
		>
			{icon}
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{summary !== undefined && (
				<span className="text-muted-foreground max-w-[45%] truncate text-xs font-normal">
					{summary}
				</span>
			)}
			{trailingIcon}
		</button>
	)
}
