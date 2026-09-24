import { cn } from '@shared/utils'
import * as React from 'react'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				'ds-field placeholder:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-visible:outline-ring flex field-sizing-content min-h-16 w-full rounded-lg border border-transparent px-3 py-2 text-base transition-[color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				className
			)}
			{...props}
		/>
	)
}

export { Textarea }
