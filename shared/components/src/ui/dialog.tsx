import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@shared/utils'
import { XIcon } from 'lucide-react'
import * as React from 'react'

import { OVERLAY_CLOSE_CLASSNAME } from './overlay-close'

function Dialog({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			className={cn(
				'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-overlay fixed inset-0 bg-black/50',
				className
			)}
			{...props}
		/>
	)
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	container,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	showCloseButton?: boolean
	/**
	 * Portal target, matching `HoverCardContent`. The content mounts on
	 * `document.body` by default, which puts it outside any themed subtree - so
	 * a dialog opened from inside a `.dark` container renders with light tokens.
	 * Pass the themed element to keep it in scope. Storybook's side-by-side
	 * themes need this; so does any app region that themes a subtree rather than
	 * the document.
	 *
	 * The content is `fixed`, so the target also has to establish a containing
	 * block - a transform, for instance - or it will centre on the viewport
	 * rather than on the container.
	 */
	container?: HTMLElement | null
}) {
	return (
		<DialogPortal data-slot="dialog-portal" container={container}>
			<DialogOverlay />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-overlay fixed top-[50%] left-[50%] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border p-6 shadow-lg duration-200 sm:max-w-lg',
					className
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						className={OVERLAY_CLOSE_CLASSNAME}
					>
						<XIcon className="size-4" />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Content>
		</DialogPortal>
	)
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="dialog-header"
			/*
			  Left-aligned at every width. The shadcn default centers below `sm`,
			  which put a centered title above left-aligned body copy in every
			  dialog that has a list or a form under it - and had call sites
			  overriding it back.
			*/
			/*
			  `pr-8` reserves the close button's corner - it is positioned against
			  the content rather than laid out in the header, so a long title ran
			  underneath it. Now that the target is 36px instead of a bare glyph,
			  the old `pr-6` at call sites was no longer enough.
			*/
			className={cn('flex flex-col gap-2 pr-8 text-left', className)}
			{...props}
		/>
	)
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
				className
			)}
			{...props}
		/>
	)
}

function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			/*
			  The h3 rung, the same as `DrawerTitle` and `SheetTitle`. A modal, a
			  drawer and a sheet are the same thing wearing different animations, so
			  their titles should not have been three different sizes. This was
			  `text-lg font-semibold` - a shadcn default, and a pairing the type
			  scale does not contain.
			*/
			className={cn('text-h3', className)}
			{...props}
		/>
	)
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	)
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger
}
