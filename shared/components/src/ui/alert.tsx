import { cn } from '@shared/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

const alertVariants = cva(
	'relative w-full rounded-xl px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
	{
		variants: {
			variant: {
				default: 'ds-raised text-card-foreground',
				destructive:
					'text-destructive ds-raised [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90',
				/*
				  Elevation comes from the ladder, as in `destructive`, so a success
				  alert nested on a raised panel keeps the same edge as every other
				  alert. The icon differs from `destructive` on purpose: it takes the
				  saturated hue while the text takes the `-foreground` role, because
				  the saturated green only just clears the 3:1 non-text floor on a
				  light raised surface and would fail outright behind body copy.
				*/
				success:
					'text-success-foreground ds-raised [&>svg]:text-success *:data-[slot=alert-description]:text-success-foreground/80'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
)

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	)
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-title"
			className={cn(
				'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
				className
			)}
			{...props}
		/>
	)
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
				className
			)}
			{...props}
		/>
	)
}

export { Alert, AlertTitle, AlertDescription }
