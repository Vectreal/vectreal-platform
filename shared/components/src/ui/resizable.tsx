import { cn } from '@shared/utils'
import { GripVerticalIcon } from 'lucide-react'
import * as React from 'react'
import * as ResizablePrimitive from 'react-resizable-panels'

/**
 * react-resizable-panels v4 renamed `PanelGroup` -> `Group` and
 * `PanelResizeHandle` -> `Separator`, replaced the group's `direction` prop
 * with `orientation`, and swapped the `data-panel-group-direction` attribute
 * for `data-group` / `data-panel` / `data-separator`. The exported names here
 * are unchanged so call sites keep working.
 */
function ResizablePanelGroup({
	className,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
	return (
		<ResizablePrimitive.Group
			data-slot="resizable-panel-group"
			// v4 sets `display:flex` and the row/column `flex-flow` inline from
			// `orientation`, so there is no direction class to apply here.
			className={cn('h-full w-full', className)}
			{...props}
		/>
	)
}

function ResizablePanel({
	...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
	withHandle,
	className,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
	withHandle?: boolean
}) {
	return (
		<ResizablePrimitive.Separator
			data-slot="resizable-handle"
			className={cn(
				'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
				// The separator's `aria-orientation` is the axis of the divider line,
				// so it reads "horizontal" inside a *vertical* group - that is the
				// case where it flattens into a full-width bar.
				'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full',
				'aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:inset-y-auto aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2',
				'[&[aria-orientation=horizontal]>div]:rotate-90',
				className
			)}
			{...props}
		>
			{withHandle && (
				<div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
					<GripVerticalIcon className="size-2.5" />
				</div>
			)}
		</ResizablePrimitive.Separator>
	)
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
