import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { useAtom } from 'jotai/react'
import { useMemo } from 'react'

import { MoveItemsDialog } from './move-items-dialog'
import { useDashboardMutations } from '../../hooks/use-dashboard-mutations'
import { planDeleteConfirmation } from '../../lib/domain/dashboard/dashboard-confirmation'
import {
	createFolderDialogAtom,
	deleteDialogAtom,
	moveDialogAtom,
	renameDialogAtom
} from '../../lib/stores/dashboard-management-store'
import { ConfirmDestructiveDialog } from '../shared/confirm-destructive-dialog'

/**
 * The dashboard's create / rename / delete dialogs, mounted once by the
 * dashboard layout and driven from anywhere via jotai atoms.
 */
export const DashboardManagementDialogs = () => {
	const [createFolderDialog, setCreateFolderDialog] = useAtom(
		createFolderDialogAtom
	)
	const [renameDialog, setRenameDialog] = useAtom(renameDialogAtom)
	const [deleteDialog, setDeleteDialog] = useAtom(deleteDialogAtom)
	const [moveDialog, setMoveDialog] = useAtom(moveDialogAtom)

	const mutations = useDashboardMutations({
		onSuccess: (response) => {
			// Closed only once the server confirms, so a rejection leaves the
			// dialog open with its error rather than silently discarding it.
			if (response.verb === 'delete') {
				setDeleteDialog({ open: false, items: [] })
			}
			if (response.verb === 'rename') {
				setRenameDialog({ open: false, item: null, name: '' })
			}
			if (response.verb === 'move') {
				setMoveDialog({ open: false, items: [], projectId: null })
			}
			if (response.verb === 'create-folder') {
				setCreateFolderDialog((prev) => ({
					...prev,
					open: false,
					name: '',
					description: ''
				}))
			}
		}
	})

	const deletePlan = useMemo(
		() => planDeleteConfirmation(deleteDialog.items),
		[deleteDialog.items]
	)

	const isBusy = mutations.state !== 'idle'

	return (
		<>
			<Dialog
				open={createFolderDialog.open}
				onOpenChange={(open) => {
					setCreateFolderDialog((prev) => ({ ...prev, open }))
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{createFolderDialog.parentFolderId
								? 'Create Subfolder'
								: 'Create Folder'}
						</DialogTitle>
						<DialogDescription>
							Enter a name for your new folder.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={createFolderDialog.name}
						onChange={(event) => {
							const name = event.target.value
							setCreateFolderDialog((prev) => ({ ...prev, name }))
						}}
						placeholder="Folder name"
					/>
					<Textarea
						value={createFolderDialog.description}
						onChange={(event) => {
							const description = event.target.value
							setCreateFolderDialog((prev) => ({ ...prev, description }))
						}}
						placeholder="Folder description (optional)"
					/>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={isBusy}
							onClick={() => {
								setCreateFolderDialog((prev) => ({
									...prev,
									open: false,
									name: '',
									description: ''
								}))
							}}
						>
							Cancel
						</Button>
						<Button
							disabled={isBusy || !createFolderDialog.name.trim()}
							onClick={() => {
								mutations.submit({
									verb: 'create-folder',
									projectId: createFolderDialog.projectId,
									name: createFolderDialog.name.trim(),
									description: createFolderDialog.description.trim() || null,
									parentFolderId: createFolderDialog.parentFolderId
								})
							}}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={renameDialog.open}
				onOpenChange={(open) => {
					setRenameDialog((prev) => ({ ...prev, open }))
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename</DialogTitle>
						<DialogDescription>
							Enter a new name for this item.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={renameDialog.name}
						onChange={(event) => {
							const name = event.target.value
							setRenameDialog((prev) => ({ ...prev, name }))
						}}
						placeholder="Name"
					/>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={isBusy}
							onClick={() =>
								setRenameDialog({ open: false, item: null, name: '' })
							}
						>
							Cancel
						</Button>
						<Button
							disabled={
								isBusy || !renameDialog.name.trim() || !renameDialog.item
							}
							onClick={() => {
								if (!renameDialog.item) {
									return
								}
								mutations.submit({
									verb: 'rename',
									target: {
										type: renameDialog.item.type,
										id: renameDialog.item.id
									},
									name: renameDialog.name.trim()
								})
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDestructiveDialog
				open={deleteDialog.open}
				onOpenChange={(open) => {
					if (!open && !isBusy) {
						setDeleteDialog({ open: false, items: [] })
					}
				}}
				plan={deletePlan}
				isPending={isBusy}
				errorMessage={mutations.lastError}
				onConfirm={(confirmationText) => {
					mutations.submit({
						verb: 'delete',
						targets: deleteDialog.items.map((item) => ({
							type: item.type,
							id: item.id
						})),
						confirmationText
					})
				}}
			/>

			<MoveItemsDialog
				open={moveDialog.open}
				onOpenChange={(open) => {
					if (!open && !isBusy) {
						setMoveDialog({ open: false, items: [], projectId: null })
					}
				}}
				items={moveDialog.items}
				projectId={moveDialog.projectId}
				isPending={isBusy}
				errorMessage={mutations.lastError}
				onConfirm={(targetFolderId) => {
					mutations.submit({
						verb: 'move',
						targets: moveDialog.items
							.filter((item) => item.type !== 'project')
							.map((item) => ({
								type: item.type as 'scene' | 'folder',
								id: item.id
							})),
						moveTarget:
							targetFolderId === null
								? { kind: 'root' }
								: { kind: 'folder', folderId: targetFolderId }
					})
				}}
			/>
		</>
	)
}
