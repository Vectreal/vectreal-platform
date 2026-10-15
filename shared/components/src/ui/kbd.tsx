import { cn } from '@shared/utils'
import * as React from 'react'

/**
 * A keyboard key, drawn as a key cap. The heavier bottom edge is what reads as
 * a key rather than a tag.
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				'bg-background text-muted-foreground border-border pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-b-2 px-1 font-mono text-[11px] leading-none font-medium select-none',
				className
			)}
			{...props}
		/>
	)
}

export { Kbd }
