import { cn } from '@shared/utils'
import * as React from 'react'

/**
 * `elevation` picks which step of the surface ladder the card sits on.
 *
 * The default `raised` is correct on the page background. On a surface that is
 * already `ds-raised` it is not: both resolve to the same 4% mix, so the card
 * has no edge at all. Nested cards step up to `overlay`.
 *
 * This is a prop rather than a `ds-overlay` class on `className`, because both
 * utilities live in `@layer components` at equal specificity - which of them won
 * would depend on their order in the stylesheet, not on the call site.
 */
function Card({
	className,
	elevation = 'raised',
	...props
}: React.ComponentProps<'div'> & { elevation?: 'raised' | 'overlay' }) {
	return (
		<div
			data-slot="card"
			className={cn(
				elevation === 'overlay' ? 'ds-overlay' : 'ds-raised',
				'text-card-foreground flex flex-col gap-6 rounded-xl py-6',
				className
			)}
			{...props}
		/>
	)
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				'@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
				className
			)}
			{...props}
		/>
	)
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-title"
			className={cn('text-xl font-light tracking-wide capitalize', className)}
			{...props}
		/>
	)
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-description"
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	)
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-action"
			className={cn(
				'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
				className
			)}
			{...props}
		/>
	)
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-content"
			className={cn('px-6', className)}
			{...props}
		/>
	)
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-footer"
			className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
			{...props}
		/>
	)
}

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardAction,
	CardDescription,
	CardContent
}
