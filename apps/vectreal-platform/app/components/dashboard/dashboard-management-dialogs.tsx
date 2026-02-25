import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@shared/components/ui/alert-dialog'
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

import { useDashboardSceneActions } from '../../hooks/use-dashboard-scene-actions'
import {
	createFolderDialogAtom,
	deleteDialogAtom,
	renameDialogAtom
} from '../../lib/stores/dashboard-management-store'

export const DashboardManagementDialogs = () => {
	const [createFolderDialog, setCreateFolderDialog] = useAtom(
		createFolderDialogAtom
	)
	const [renameDialog, setRenameDialog] = useAtom(renameDialogAtom)
	const [deleteDialog, setDeleteDialog] = useAtom(deleteDialogAtom)
	const { runContentAction, actionState } = useDashboardSceneActions()

	const deleteLabel =
		deleteDialog.items.length === 1
			? deleteDialog.items[0].type === 'folder'
				? 'Folder'
				: 'Scene'
			: 'Items'

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
							disabled={actionState !== 'idle'}
							onClick={() => {
								runContentAction('create-folder', {
									projectId: createFolderDialog.projectId,
									parentFolderId: createFolderDialog.parentFolderId,
									name: createFolderDialog.name,
									description: createFolderDialog.description
								})
								setCreateFolderDialog((prev) => ({
									...prev,
									open: false,
									name: '',
									description: ''
								}))
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
					if (!open) {
						setRenameDialog({ open: false, item: null, name: '' })
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Rename {renameDialog.item?.type === 'folder' ? 'Folder' : 'Scene'}
						</DialogTitle>
						<DialogDescription>
							Update the{' '}
							{renameDialog.item?.type === 'folder' ? 'folder' : 'scene'} name.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={renameDialog.name}
						onChange={(event) => {
							const name = event.target.value
							setRenameDialog((prev) => ({ ...prev, name }))
						}}
						placeholder="Item name"
					/>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() =>
								setRenameDialog({ open: false, item: null, name: '' })
							}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (!renameDialog.item) {
									return
								}

								runContentAction('rename', {
									items: [renameDialog.item],
									name: renameDialog.name
								})
								setRenameDialog({ open: false, item: null, name: '' })
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={deleteDialog.open}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteDialog({ open: false, items: [] })
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {deleteLabel}</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteDialog.items.length === 1
								? `Delete "${deleteDialog.items[0].name}"? This action cannot be undone.`
								: `Delete ${deleteDialog.items.length} selected items? This action cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								runContentAction('delete', {
									items: deleteDialog.items
								})
								setDeleteDialog({ open: false, items: [] })
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
