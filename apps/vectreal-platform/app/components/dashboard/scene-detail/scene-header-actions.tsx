import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { Ellipsis, Eye, Rocket, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { SceneShareDrawer } from './scene-share-drawer'
import { useDashboardMutations } from '../../../hooks/use-dashboard-mutations'
import { useIsClientMounted } from '../../../hooks/use-is-client-mounted'
import { planDeleteConfirmation } from '../../../lib/domain/dashboard/dashboard-confirmation'
import { ConfirmDestructiveDialog } from '../../shared/confirm-destructive-dialog'
import { DESTRUCTIVE_MENU_ITEM } from '../table-columns'

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'

interface SceneHeaderActionsProps {
	previewPath: string
	publisherPath: string
	sceneId: string
	projectId: string
	publishState: ScenePublishStateResponse
	onPublish: () => void
	/** The scene as the confirmation copy needs to know it. */
	deleteRef: DashboardEntityRef
	canDelete: boolean
	/** Deleting succeeds by leaving this page, which only the route can do. */
	onDeleted: () => void
}

/**
 * Everything you can do to this scene from its own page.
 *
 * Stacked, so both labels are left-aligned: centring puts each icon at a
 * different x because the labels differ in width, and the icons stop reading as
 * a column.
 *
 * Delete lives in the overflow menu rather than in a Danger Zone section on one
 * of the two content surfaces, which is where the rest of the dashboard already
 * keeps it - see `SceneActionsCell` in `table-columns.tsx`.
 *
 * One thing is deliberately not copied from `ProjectActionsCell` beside it: its
 * disabled Delete, under a muted line naming the roles that are allowed to.
 * Delete is the only entry in this menu, and Radix gives the roving-focus group
 * `focusable: !disabled`, so for a member the menu would open onto nothing
 * reachable - arrow keys move through no items, and the bare `<p>` beside them
 * is not an owned child of `role="menu"`, so it is never announced.
 *
 * `ProjectActionsCell` survives that because it keeps an enabled `Edit project`
 * item beside the disabled Delete. This menu has no second item to survive on,
 * so a role that cannot delete gets no menu at all.
 *
 * The rule it shares with `SceneActionsCell` is the smaller one: omit the item,
 * never render it disabled. That cell can still show a menu without a delete
 * handler because three navigation items remain in it. This one would be empty.
 */
export function SceneHeaderActions({
	previewPath,
	publisherPath,
	sceneId,
	projectId,
	publishState,
	onPublish,
	deleteRef,
	canDelete,
	onDeleted
}: SceneHeaderActionsProps) {
	const isClientMounted = useIsClientMounted()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const deletePlan = useMemo(
		() => planDeleteConfirmation([deleteRef]),
		[deleteRef]
	)
	const deleteMutation = useDashboardMutations({ onSuccess: onDeleted })
	const isDeleting = deleteMutation.state !== 'idle'

	/*
	  `More scene actions` contains the visible `More`, which is what WCAG 2.5.3
	  asks: a speech-input user saying "click More" has to reach it. The icon-only
	  triggers in `table-columns.tsx` name themselves entirely, because there is no
	  visible text for a name to contain.
	*/
	const overflowTrigger = (
		<Button
			variant="ghost"
			className="w-full justify-start"
			aria-label="More scene actions"
			disabled={!isClientMounted}
		>
			<Ellipsis className="mr-2 h-4 w-4 shrink-0" />
			More
		</Button>
	)

	return (
		<div className="flex shrink-0 flex-col gap-3 max-md:w-full xl:justify-end">
			<Button asChild className="w-full justify-start">
				<Link viewTransition to={previewPath}>
					<Eye className="mr-2 h-4 w-4 shrink-0" />
					Preview
				</Link>
			</Button>

			<Button variant="secondary" asChild className="w-full justify-start">
				<Link viewTransition to={publisherPath}>
					<Rocket className="mr-2 h-4 w-4 shrink-0" />
					Open in Publisher
				</Link>
			</Button>

			<SceneShareDrawer
				sceneId={sceneId}
				projectId={projectId}
				publishState={publishState}
				onPublish={onPublish}
			/>

			{canDelete ? (
				<>
					{/*
					  A live-looking trigger that cannot open is worse than a disabled
					  one, so this waits for hydration exactly as every other actions
					  menu in the dashboard does. `use-is-client-mounted.ts` states the
					  reason: a Radix trigger is inert until the bundle lands, and this
					  is now the only path to deleting a scene from this page.
					*/}
					{isClientMounted ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								{overflowTrigger}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuItem
									disabled={isDeleting}
									onClick={() => setDeleteDialogOpen(true)}
									className={DESTRUCTIVE_MENU_ITEM}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete scene
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						overflowTrigger
					)}

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
			) : null}
		</div>
	)
}
