import { cn } from '@shared/utils'
import { XIcon } from 'lucide-react'
import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { OVERLAY_CLOSE_CLASSNAME } from './overlay-close'

function Drawer({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
	return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
	return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
	return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
	return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
	return (
		<DrawerPrimitive.Overlay
			data-slot="drawer-overlay"
			className={cn(
				'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-overlay fixed inset-0 bg-black/50',
				className
			)}
			{...props}
		/>
	)
}

function DrawerContent({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
	/** Matches `DialogContent`. Set false where closing is deliberately blocked. */
	showCloseButton?: boolean
}) {
	return (
		<DrawerPortal data-slot="drawer-portal">
			<DrawerOverlay />
			<DrawerPrimitive.Content
				data-slot="drawer-content"
				className={cn(
					'group/drawer-content bg-background z-overlay fixed flex h-auto flex-col',
					'data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b',
					'data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t',
					'data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm',
					'data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm',
					className
				)}
				{...props}
			>
				<div className="bg-muted mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
				{children}
				{/*
				  Built in, the way dialog and sheet already do it. The drawer shipped
				  without one, so every consumer hand-rolled a `DrawerClose` wrapping a
				  ghost icon button inside its own header - six copies, none of them
				  the same size or shape as the sheet's.
				*/}
				{showCloseButton && (
					<DrawerPrimitive.Close
						data-slot="drawer-close"
						className={OVERLAY_CLOSE_CLASSNAME}
					>
						<XIcon className="size-4" />
						<span className="sr-only">Close</span>
					</DrawerPrimitive.Close>
				)}
			</DrawerPrimitive.Content>
		</DrawerPortal>
	)
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="drawer-header"
			/*
			  `p-6` to match the drawer bodies. Every consumer in the app pads its
			  content `p-6` against a `p-4` header, so the heading and the content
			  beneath it did not share a left edge in any of them.

			  `pr-14` reserves the close button's corner. It is positioned against
			  the content, not laid out in the header, so without this a long title
			  runs underneath it.
			*/
			className={cn('flex flex-col gap-1.5 p-6 pr-14', className)}
			{...props}
		/>
	)
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="drawer-footer"
			/*
			  The same shape as `DialogFooter`: stacked on a narrow viewport,
			  right-aligned row above it. This defaulted to a permanently stacked
			  column, which suits a bottom sheet on a phone but not a `max-w-lg`
			  side drawer - so two consumers stacked full-width buttons while two
			  others hand-rolled their own right-aligned row instead.

			  `p-6` matches the header and the bodies.
			*/
			className={cn(
				'mt-auto flex flex-col-reverse gap-2 p-6 sm:flex-row sm:justify-end',
				className
			)}
			{...props}
		/>
	)
}

function DrawerTitle({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			/*
			  `.text-h3` rather than a Tailwind size, for two reasons.

			  It has to declare a size at all: Radix renders this as an `<h2>`, and
			  the base layer sizes a bare `h2` at `--text-h2` (28px here), so a title
			  with no size class rendered as a display heading.

			  And it has to be *this* size: `text-lg font-semibold` is the shadcn
			  default, which is nothing the type scale says. Panel headings in this
			  system are the h3 rung with its own weight and negative tracking - the
			  same family as `CardTitle` and the scene detail heading. `.text-h3`
			  lives in `@layer components`, so a caller passing a Tailwind size still
			  wins.
			*/
			className={cn('text-foreground text-h3', className)}
			{...props}
		/>
	)
}

function DrawerDescription({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	)
}

export {
	Drawer,
	DrawerPortal,
	DrawerOverlay,
	DrawerTrigger,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
	DrawerDescription
}
