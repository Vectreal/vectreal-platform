import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'

import type { ReactNode } from 'react'

/**
 * The quietest control on the page, at the foot of the surface it belongs to.
 *
 * This is `scene-detail/scene-delete-button.tsx`'s decision, extracted so the
 * other three surfaces that destroy something can share it. That file's
 * reasoning is the reason this exists, and it is worth keeping:
 *
 *   A full-width destructive button in a "Danger Zone" section gave the loudest
 *   treatment in the app to the action nobody comes here to take.
 *
 * A ghost with muted text is what is left: present, findable, and not competing
 * with what the page is actually for. The colour arrives on hover and on focus,
 * with the intent, rather than sitting on the page advertising danger.
 *
 * Three surfaces had grown their own Danger zone anyway - account settings, the
 * organization detail page and the project edit drawer - each with a
 * destructive-coloured heading, each spelled differently, and one with a
 * destructive border around the whole block. A pattern that one page rejected
 * for a stated reason and three pages kept is not a pattern, it is a default.
 *
 * `note` is for a reason the reader cannot act on the control, and it is the
 * only thing that makes a disabled destructive action legitimate:
 * `table-columns.tsx` puts it as "a disabled item explains itself". Where there
 * is no explanation to give, render nothing at all instead - that is the other
 * half of the same rule, and it belongs to the caller, because only the caller
 * knows whether the reader has a move.
 */

interface DestructiveActionProps {
	/** What this destroys, in one sentence, above the control. */
	description: ReactNode
	/**
	 * A constraint on the action: a standing rule about when it is possible, or
	 * the reason it is unavailable to this reader right now.
	 *
	 * Worth showing only when the reader could act on it. Where the answer is
	 * "nothing you can do", render no control at all instead - see the note
	 * above about which half of that rule belongs to the caller.
	 */
	note?: ReactNode
	children: ReactNode
	className?: string
}

export function DestructiveAction({
	description,
	note,
	children,
	className
}: DestructiveActionProps) {
	return (
		<div className={cn('space-y-2', className)}>
			<p className="text-muted-foreground text-sm">{description}</p>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
			{note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
		</div>
	)
}

interface DestructiveActionButtonProps extends React.ComponentProps<
	typeof Button
> {
	children: ReactNode
}

/**
 * The control itself, so the four call sites cannot drift on the treatment the
 * way the four Danger zones did.
 *
 * `size="sm"` and `variant="ghost"` rather than `destructive`: the fill is what
 * made these read as the page's primary action.
 */
export function DestructiveActionButton({
	className,
	children,
	...props
}: DestructiveActionButtonProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn(
				'text-muted-foreground hover:text-destructive focus-visible:text-destructive',
				/*
				  Pulled back by its own horizontal padding. A bordered control aligns
				  to the eye by its box; a borderless one aligns by its text, and
				  `size="sm"`'s 12px of padding read as an indent against the sentence
				  directly above it - measured at every call site, because all four put
				  this button under copy that starts at the container's content edge.
				  Only the hover fill extends past that edge, which is what a ghost
				  control does everywhere else.
				*/
				'-ml-3',
				className
			)}
			{...props}
		>
			{children}
		</Button>
	)
}
