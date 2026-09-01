import { Button } from '@shared/components/ui/button'
import { useMemo, useState } from 'react'

import { useDashboardMutations } from '../../../hooks/use-dashboard-mutations'
import { useIsClientMounted } from '../../../hooks/use-is-client-mounted'
import { planDeleteConfirmation } from '../../../lib/domain/dashboard/dashboard-confirmation'
import { ConfirmDestructiveDialog } from '../../shared/confirm-destructive-dialog'

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'

interface SceneDeleteButtonProps {
	sceneId: string
	/** The scene as the confirmation copy needs to know it. */
	deleteRef: DashboardEntityRef
	canDelete: boolean
	/** Deleting succeeds by leaving this page, which only the route can do. */
	onDeleted: () => void
}

/**
 * The quietest control on the page, at the foot of the surface it belongs to.
 *
 * It has been three things. A full-width destructive button in a "Danger Zone"
 * section, which gave the loudest treatment in the app to the action nobody
 * comes here to take. Then a fourth button in the header's action stack, which
 * made two calls to action look like four. Then an overflow menu of exactly one
 * item - and a menu whose only entry is disabled for the reader is a menu that
 * opens onto nothing reachable, because Radix will not focus a disabled item.
 *
 * A ghost with muted text is what is left: present, findable, and not competing
 * with Preview or with the doors above it. It turns destructive on hover and on
 * focus, so the colour arrives with the intent rather than sitting on the page
 * advertising danger.
 *
 * A role that cannot delete gets nothing rather than a disabled control. There
 * is no explanation to attach it to and nothing for them to do about it.
 */
export function SceneDeleteButton({
	sceneId,
	deleteRef,
	canDelete,
	onDeleted
}: SceneDeleteButtonProps) {
	const isClientMounted = useIsClientMounted()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const deletePlan = useMemo(
		() => planDeleteConfirmation([deleteRef]),
		[deleteRef]
	)
	const deleteMutation = useDashboardMutations({ onSuccess: onDeleted })
	const isDeleting = deleteMutation.state !== 'idle'

	if (!canDelete) {
		return null
	}

	return (
		<>
			{/*
			  Disabled until hydration, for the reason `use-is-client-mounted.ts`
			  gives: the click opens a dialog held in React state, so before the
			  bundle lands this looks live and does nothing. It is the only path to
			  deleting a scene from this page.
			*/}
			<Button
				variant="ghost"
				size="sm"
				disabled={!isClientMounted || isDeleting}
				onClick={() => setDeleteDialogOpen(true)}
				className="text-muted-foreground hover:text-destructive focus-visible:text-destructive w-full"
			>
				Delete scene
			</Button>

			<ConfirmDestructiveDialog
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					if (!open && isDeleting) {
						return
					}
					setDeleteDialogOpen(open)
				}}
				plan={deletePlan}
				isPending={isDeleting}
				errorMessage={deleteMutation.lastError}
				onConfirm={(confirmationText) => {
					deleteMutation.submit({
						verb: 'delete',
						targets: [{ type: 'scene', id: sceneId }],
						confirmationText
					})
				}}
			/>
		</>
	)
}
