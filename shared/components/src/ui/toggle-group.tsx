'use client'

import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@shared/utils'
import { type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { toggleVariants } from './toggle'

const ToggleGroupContext = React.createContext<
	VariantProps<typeof toggleVariants>
>({
	size: 'default',
	variant: 'default'
})

function ToggleGroup({
	className,
	variant,
	size,
	children,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
	VariantProps<typeof toggleVariants>) {
	return (
		<ToggleGroupPrimitive.Root
			data-slot="toggle-group"
			data-variant={variant}
			data-size={size}
			className={cn(
				'group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs',
				className
			)}
			{...props}
		>
			<ToggleGroupContext.Provider value={{ variant, size }}>
				{children}
			</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive.Root>
	)
}

function ToggleGroupItem({
	className,
	children,
	variant,
	size,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
	VariantProps<typeof toggleVariants>) {
	const context = React.useContext(ToggleGroupContext)

	return (
		<ToggleGroupPrimitive.Item
			data-slot="toggle-group-item"
			data-variant={context.variant || variant}
			data-size={context.size || size}
			className={cn(
				toggleVariants({
					variant: context.variant || variant,
					size: context.size || size
				}),
				'min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l',
				/*
				  The selected segment, as a step on the surface ladder.

				  `toggleVariants` marks "on" with `bg-accent`, and `--accent` is the
				  hover background - oklch(0.97) in light mode. Every group in the
				  dashboard sits on a `ds-sunken` track, which mixes to nearly the same
				  value, so in light mode the selected option could not be seen at all:
				  the projects view switch and the plan switch read as two identical,
				  unpressed labels. The chosen segment now rises to the page's own
				  background, against a well 2.5% darker than it.

				  Value alone, with no shadow: `elevation.md` reserves those for
				  portalled overlays, and a track is not one. `TabsTrigger` does carry
				  one, but that is the untouched shadcn default rather than a decision
				  to copy.

				  Dark mode takes 10% of the foreground instead, because a plain
				  background swap is near-invisible over a 2.5% well on a phone.
				*/
				'data-[state=on]:bg-background dark:data-[state=on]:bg-foreground/10',
				className
			)}
			{...props}
		>
			{children}
		</ToggleGroupPrimitive.Item>
	)
}

export { ToggleGroup, ToggleGroupItem }
