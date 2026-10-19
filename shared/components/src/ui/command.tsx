'use client'

import { cn } from '@shared/utils'
import { Command as CommandPrimitive } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import * as React from 'react'

function Command({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				'ds-tint-overlay text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-xl',
				className
			)}
			{...props}
		/>
	)
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="flex h-9 items-center gap-2 border-b px-3"
		>
			<SearchIcon className="size-4 shrink-0 opacity-50" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
					className
				)}
				{...props}
			/>
		</div>
	)
}

function CommandList({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn(
				'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
				className
			)}
			{...props}
		/>
	)
}

function CommandEmpty({
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className="py-6 text-center text-sm"
			{...props}
		/>
	)
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				/*
				  The size arrives as the raw token rather than `.text-label-xs`.

				  `--text-*` are plain custom properties here, deliberately not
				  `@theme` keys, so `text-label-xs` is a hand-written class in
				  `@layer components` and not a utility Tailwind owns - which means
				  it cannot be composed through an arbitrary variant. Written as
				  `[&_[cmdk-group-heading]]:text-label-xs` it produced no CSS at all
				  and the heading inherited 16px from the palette root.

				  cmdk renders this heading itself from the `heading` prop, so a
				  variant is the only way to reach it. Reading the token through an
				  arbitrary value keeps it on the scale without restating 0.6875rem.
				*/
				'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[length:var(--text-label-xs)] [&_[cmdk-group-heading]]:font-medium',
				className
			)}
			{...props}
		/>
	)
}

function CommandItem({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				// `rounded-lg`, concentric with the palette around it: the container is
				// `rounded-xl` (20px) and the group insets an item by `p-1` (4px), so
				// the matching inner arc is 16px. At `rounded-sm` (10px) the item
				// curved twice as fast as the corner it sat in. This is the pairing
				// `dropdown-menu` already uses.
				"data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			{...props}
		/>
	)
}

export {
	Command,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem
}
