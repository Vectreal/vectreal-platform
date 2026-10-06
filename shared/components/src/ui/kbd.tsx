import { cn } from '@shared/utils'
import * as React from 'react'

/**
 * A keyboard key, drawn as a key cap. The heavier bottom edge is what reads as
 * a key rather than a tag. Each side is set on its own: the viewer's stylesheet
 * emits an unlayered `.border`, which beats a layered `border-b-2`.
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				'bg-background text-muted-foreground border-border pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-sm border-x border-t border-b-2 px-1 font-mono text-[11px] leading-none font-medium select-none',
				className
			)}
			{...props}
		/>
	)
}

export { Kbd }
