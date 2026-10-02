'use client'

import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@shared/utils'
import * as React from 'react'

import { ActiveIndicator } from './active-indicator'

/** What a segment needs to know to carry the sliding fill. */
interface ToggleGroupSelection {
	layoutId: string
	selected: string | undefined
}

const ToggleGroupSelectionContext =
	React.createContext<ToggleGroupSelection | null>(null)

/**
 * A segmented control: one track, one segment filled.
 *
 * The selected segment fills with `--foreground` and its label inverts, the
 * same "on" as `Toggle` and the fill of `Slider`. That is a value change rather
 * than a hue, so the selection reads without color vision. The old segment
 * marked "on" with `bg-accent`, which is the hover token and was nearly
 * invisible over its track in light mode.
 *
 * The track is `ds-field`, a tint over whatever the group sits on, so the
 * same group works on the page, in a dialog and on a publisher shell panel.
 * Callers lay out the segments (a grid for many short options) through
 * `className`; they do not restyle the surface.
 *
 * In a single-select group whose value is known, the fill is one
 * `ActiveIndicator` that slides to the selected segment. Anywhere it is not
 * known (a multiple-select group, or one left uncontrolled) each segment that
 * is on fills in place instead.
 */
function ToggleGroup({
	className,
	children,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
	const layoutId = React.useId()
	const selected = props.type === 'single' ? props.value : undefined
	const selection = React.useMemo(
		() => ({ layoutId, selected }),
		[layoutId, selected]
	)
	return (
		<ToggleGroupSelectionContext.Provider value={selection}>
			<ToggleGroupPrimitive.Root
				data-slot="toggle-group"
				className={cn('ds-field flex w-full gap-1 rounded-xl p-1', className)}
				{...props}
			>
				{children}
			</ToggleGroupPrimitive.Root>
		</ToggleGroupSelectionContext.Provider>
	)
}

function ToggleGroupItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
	const selection = React.useContext(ToggleGroupSelectionContext)
	const slides = selection?.selected !== undefined
	return (
		<ToggleGroupPrimitive.Item
			data-slot="toggle-group-item"
			className={cn(
				'text-muted-foreground hover:text-foreground relative isolate inline-flex min-h-8 min-w-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium whitespace-nowrap',
				'transition-colors duration-150 motion-reduce:transition-none',
				'data-[state=on]:text-background',
				!slides && 'data-[state=on]:bg-foreground',
				'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-1',
				'disabled:pointer-events-none disabled:opacity-50',
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			{...props}
		>
			{slides && selection.selected === props.value && (
				<ActiveIndicator layoutId={selection.layoutId} />
			)}
			{children}
		</ToggleGroupPrimitive.Item>
	)
}

export { ToggleGroup, ToggleGroupItem }
