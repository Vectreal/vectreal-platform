import { cn } from '@shared/utils'
import * as React from 'react'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card"
			className={cn(
				'ds-raised text-card-foreground flex flex-col gap-6 rounded-xl py-6',
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

/*
  `text-h4`, the panel-heading rung, and nothing else.

  The base used to be `text-xl font-light tracking-wide capitalize`, and all
  four of those were doing damage. `capitalize` made a copy decision in CSS:
  every card title in the product rendered title-cased, so "Send a message"
  reached the reader as "Send A Message" with the article capitalised, and no
  amount of editing the string could change it. `font-light` (300) and
  `tracking-wide` (+0.025em) are utilities, so they beat whichever rung a caller
  passed from `@layer components` - a title asking for `text-h3` got h3's size
  with 300 weight and positive tracking, the opposite of that rung's spec.

  `text-xl` was merely off-scale, and is the one a caller could already
  override.
*/
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-title"
			className={cn('text-h4', className)}
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
