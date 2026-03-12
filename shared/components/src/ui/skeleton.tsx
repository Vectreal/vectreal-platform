import { cn } from '@shared/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="skeleton"
			className={cn('bg-muted/80 animate-skeleton-fade rounded-2xl', className)}
			{...props}
		/>
	)
}

export { Skeleton }
