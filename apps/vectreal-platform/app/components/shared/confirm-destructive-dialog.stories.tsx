import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { useState, type ComponentProps, type ReactNode } from 'react'

import { ConfirmDestructiveDialog } from './confirm-destructive-dialog'
import {
	planDeleteConfirmation,
	toFolderRef,
	toProjectRef,
	toSceneRef
} from '../../lib/domain/dashboard/dashboard-confirmation'

import type { Meta, StoryObj } from '@storybook/react-vite'

const noop = () => {}

/*
  Each theme gets a stage, and the dialog portals into it.

  The global decorator renders a story twice, in a light wrapper and a `.dark`
  one, but `Dialog` mounts on `document.body` - outside both of them. The dark
  column's trigger opened a light dialog, every time. `transform-gpu` is what
  makes the stage a containing block for the `fixed` content, so it centres on
  the column instead of the viewport.
*/
function ThemedStage({
	theme,
	children
}: {
	theme: 'light' | 'dark'
	children: (container: HTMLElement | null) => ReactNode
}) {
	const [stage, setStage] = useState<HTMLDivElement | null>(null)

	return (
		<div
			ref={setStage}
			className={cn(
				// Tall enough for the longest tier - the dialog is `fixed`, so it
				// adds nothing to the stage's own height and a short stage would
				// crop it against `overflow-hidden`.
				'bg-background text-foreground relative grid min-h-[36rem] transform-gpu place-items-center overflow-hidden p-8',
				theme === 'dark' && 'dark'
			)}
		>
			{children(stage)}
		</div>
	)
}

function TriggeredDialog({
	args,
	container
}: {
	args: ComponentProps<typeof ConfirmDestructiveDialog>
	container: HTMLElement | null
}) {
	const [open, setOpen] = useState(false)

	return (
		<>
			<Button variant="outline" onClick={() => setOpen(true)}>
				{args.plan.confirmLabel}
			</Button>
			<ConfirmDestructiveDialog
				{...args}
				open={open}
				onOpenChange={setOpen}
				container={container}
			/>
		</>
	)
}

/**
 * The one destructive confirmation in the dashboard, in each tier the policy
 * can produce.
 *
 * Every plan here comes from `planDeleteConfirmation` rather than a hand-written
 * prop object, so these stories fail the same way the product would if the tier
 * ladder changed - the copy is data, and this renders the real data.
 *
 * Each story is a trigger and a closable dialog rather than one pinned open.
 * `Dialog` portals to `document.body` and the docs page renders every story on
 * one canvas, so hard-coding `open` stacked all eight on top of each other with
 * inert callbacks: nothing legible, and no way out of any of them.
 *
 * Confirm is still a no-op, which is the component's actual contract - it does
 * not close itself, so a server rejection stays on screen next to the input that
 * caused it. Cancel, Escape and the close button are what dismiss it.
 */
const meta = {
	title: 'Dashboard/Confirm destructive',
	component: ConfirmDestructiveDialog,
	// The light/dark pair is built below rather than by the decorator, so each
	// dialog can portal into the theme its trigger belongs to.
	parameters: { layout: 'fullscreen', dualTheme: false },
	args: { open: false, onOpenChange: noop, onConfirm: noop },
	render: (args) => (
		<>
			{(['light', 'dark'] as const).map((theme) => (
				<ThemedStage key={theme} theme={theme}>
					{(container) => <TriggeredDialog args={args} container={container} />}
				</ThemedStage>
			))}
		</>
	)
} satisfies Meta<typeof ConfirmDestructiveDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A draft scene: nothing is live, so one click is proportionate. */
export const Acknowledge: Story = {
	args: {
		plan: planDeleteConfirmation([
			toSceneRef({
				id: 'scene-1',
				name: 'Untitled draft',
				projectId: 'project-1',
				status: 'draft'
			})
		])
	}
}

/**
 * A published scene. The tier the whole change exists for: live embeds break the
 * moment this completes, so it asks for the token.
 */
export const TypedPublishedScene: Story = {
	args: {
		plan: planDeleteConfirmation([
			toSceneRef({
				id: 'scene-2',
				name: 'Product Hero',
				projectId: 'project-1',
				status: 'published'
			})
		])
	}
}

/** A folder with contents. The count drives the tier, so it is stated. */
export const TypedNonEmptyFolder: Story = {
	args: {
		plan: planDeleteConfirmation([
			toFolderRef({
				id: 'folder-1',
				name: 'Showroom',
				projectId: 'project-1',
				childCount: 12
			})
		])
	}
}

/** The longest copy the ladder produces - the layout has to hold at this size. */
export const TypedProject: Story = {
	args: {
		plan: planDeleteConfirmation([
			toProjectRef({
				id: 'project-1',
				name: 'Studio Showcase',
				sceneCount: 24,
				counts: { published: 6 }
			})
		])
	}
}

/** Bulk crosses the threshold on count alone, regardless of what is in it. */
export const TypedBulk: Story = {
	args: {
		plan: planDeleteConfirmation(
			Array.from({ length: 6 }, (_, index) =>
				toSceneRef({
					id: `scene-${index}`,
					name: `Scene ${index + 1}`,
					projectId: 'project-1',
					status: 'draft'
				})
			)
		)
	}
}

/** Confirm is disabled and says why, rather than failing after the request. */
export const Blocked: Story = {
	args: {
		blockedReason: 'Only organization owners can delete a project.',
		plan: planDeleteConfirmation([
			toProjectRef({ id: 'project-1', name: 'Studio Showcase' })
		])
	}
}

/**
 * A server rejection. The dialog deliberately does not close on confirm, so the
 * message lands next to the input that caused it instead of behind a toast.
 */
export const ServerError: Story = {
	args: {
		errorMessage: 'This deletion requires typing DELETE to confirm.',
		plan: planDeleteConfirmation([
			toSceneRef({
				id: 'scene-2',
				name: 'Product Hero',
				projectId: 'project-1',
				status: 'published'
			})
		])
	}
}

/** Mid-flight: confirm is disabled and both buttons are inert. */
export const Pending: Story = {
	args: {
		isPending: true,
		plan: planDeleteConfirmation([
			toSceneRef({
				id: 'scene-1',
				name: 'Untitled draft',
				projectId: 'project-1',
				status: 'draft'
			})
		])
	}
}
