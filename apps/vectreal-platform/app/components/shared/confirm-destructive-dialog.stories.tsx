import { ConfirmDestructiveDialog } from './confirm-destructive-dialog'
import {
	planDeleteConfirmation,
	toFolderRef,
	toProjectRef,
	toSceneRef
} from '../../lib/domain/dashboard/dashboard-confirmation'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The one destructive confirmation in the dashboard, in each tier the policy
 * can produce.
 *
 * Every plan here comes from `planDeleteConfirmation` rather than a hand-written
 * prop object, so these stories fail the same way the product would if the tier
 * ladder changed - the copy is data, and this renders the real data.
 *
 * Rendered inline rather than through the dialog's own portal so all the states
 * are visible at once; `open` stays true and the callbacks are inert.
 */
const meta = {
	title: 'Dashboard/Confirm destructive',
	component: ConfirmDestructiveDialog,
	parameters: { layout: 'centered' }
} satisfies Meta<typeof ConfirmDestructiveDialog>

export default meta
type Story = StoryObj<typeof meta>

const noop = () => {}

/** A draft scene: nothing is live, so one click is proportionate. */
export const Acknowledge: Story = {
	args: {
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
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
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
		plan: planDeleteConfirmation([
			toSceneRef({
				id: 'scene-2',
				name: 'Porsche 911',
				projectId: 'project-1',
				status: 'published'
			})
		])
	}
}

/** A folder with contents. The count drives the tier, so it is stated. */
export const TypedNonEmptyFolder: Story = {
	args: {
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
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
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
		plan: planDeleteConfirmation([
			toProjectRef({
				id: 'project-1',
				name: 'Configurator',
				sceneCount: 24,
				counts: { published: 6 }
			})
		])
	}
}

/** Bulk crosses the threshold on count alone, regardless of what is in it. */
export const TypedBulk: Story = {
	args: {
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
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
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
		blockedReason: 'Only organization owners can delete a project.',
		plan: planDeleteConfirmation([
			toProjectRef({ id: 'project-1', name: 'Configurator' })
		])
	}
}

/**
 * A server rejection. The dialog deliberately does not close on confirm, so the
 * message lands next to the input that caused it instead of behind a toast.
 */
export const ServerError: Story = {
	args: {
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
		errorMessage: 'This deletion requires typing DELETE to confirm.',
		plan: planDeleteConfirmation([
			toSceneRef({
				id: 'scene-2',
				name: 'Porsche 911',
				projectId: 'project-1',
				status: 'published'
			})
		])
	}
}

/** Mid-flight: confirm is disabled and both buttons are inert. */
export const Pending: Story = {
	args: {
		open: true,
		onOpenChange: noop,
		onConfirm: noop,
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
