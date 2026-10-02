'use client'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@shared/utils'
import * as React from 'react'

type SwitchRootProps = Omit<
	React.ComponentProps<typeof SwitchPrimitive.Root>,
	'children'
>

interface ToggleTileProps extends SwitchRootProps {
	layout: 'tile'
	/** The tile's accessible name, shown under the icon. Keep it to a word or two. */
	label: string
	icon: React.ReactNode
}

interface ToggleRowProps extends SwitchRootProps {
	layout?: 'row'
	label: React.ReactNode
	description?: React.ReactNode
}

export type ToggleProps = ToggleTileProps | ToggleRowProps

/*
  Surface and content change on one transition. `ds-field-interactive` eases
  only the background, so on its own the label (or the row's thumb) flipped
  to the "on" color at once while the fill was still fading in: for a few
  frames it was dark on dark and vanished. The toggle group does the same.
*/
const TRANSITION =
	'transition-colors duration-150 motion-reduce:transition-none'

/**
 * The one on/off control. Both layouts are a Radix Switch underneath, so both
 * announce as `role="switch"` with `aria-checked`, and both say "on" the same
 * way: the surface fills with `--foreground` and its content inverts. The state
 * is a value change, never a hue, so it does not depend on color vision.
 *
 * - `tile` is the Control Center shape: icon at the center, a short label under
 *   it, sized for a bento grid of settings.
 * - `row` is for form-like lists where each option needs a sentence, such as
 *   the consent dialog: text on the left, a compact fill toggle on the right.
 *
 * The resting surface is `ds-field-interactive`, a tint over whatever the
 * toggle sits on, because toggles sit on pages, dialogs and shell panels alike.
 */
function Toggle(props: ToggleProps) {
	if (props.layout === 'tile') {
		const { label, icon, className, layout: _layout, ...rootProps } = props
		return (
			<SwitchPrimitive.Root
				data-slot="toggle"
				data-layout="tile"
				className={cn(
					'ds-field-interactive text-foreground flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center text-xs font-medium',
					'data-[state=checked]:bg-foreground data-[state=checked]:text-background',
					TRANSITION,
					'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
					'disabled:cursor-not-allowed disabled:opacity-50',
					'[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-5',
					className
				)}
				{...rootProps}
			>
				{icon}
				<span className="line-clamp-2 leading-tight">{label}</span>
			</SwitchPrimitive.Root>
		)
	}

	return <ToggleRow {...props} />
}

function ToggleRow({
	label,
	description,
	className,
	id,
	layout: _layout,
	...rootProps
}: ToggleRowProps) {
	const generatedId = React.useId()
	const switchId = id ?? generatedId
	const descriptionId = `${switchId}-description`

	return (
		<div
			data-slot="toggle"
			data-layout="row"
			className={cn('flex items-start justify-between gap-4', className)}
		>
			<div className="min-w-0 flex-1">
				<label htmlFor={switchId} className="text-sm font-medium">
					{label}
				</label>
				{description && (
					<p
						id={descriptionId}
						className="text-muted-foreground mt-0.5 text-xs"
					>
						{description}
					</p>
				)}
			</div>
			<SwitchPrimitive.Root
				id={switchId}
				aria-describedby={description ? descriptionId : undefined}
				className={cn(
					'ds-field-interactive peer inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5',
					'data-[state=checked]:bg-foreground',
					TRANSITION,
					'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
					'disabled:cursor-not-allowed disabled:opacity-50'
				)}
				{...rootProps}
			>
				<SwitchPrimitive.Thumb
					className={cn(
						'bg-foreground/45 data-[state=checked]:bg-background pointer-events-none block size-5 rounded-full',
						'transition-[translate,background-color] duration-150 data-[state=checked]:translate-x-4 motion-reduce:transition-none'
					)}
				/>
			</SwitchPrimitive.Root>
		</div>
	)
}

export { Toggle }
