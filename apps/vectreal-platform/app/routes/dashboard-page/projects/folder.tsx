import { Button } from '@shared/components/ui/button'
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
import { FolderSearch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DataTable } from '../../../components/dashboard/data-table'
import {
	createContentColumns,
	type ContentRow
} from '../../../components/dashboard/project-table-columns'
import { FolderContentSkeleton } from '../../../components/skeletons'
import { useDashboardSceneActions } from '../../../hooks/use-dashboard-scene-actions'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getChildFolders,
	getFolderScenes,
	getSceneFolder
} from '../../../lib/domain/scene/scene-folder-repository.server'

import { Route } from './+types/folder'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle
} from '@shared/components/ui/empty'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId
	const folderId = params.folderId

	if (!projectId || !folderId) {
		throw new Response('Project ID and Folder ID are required', { status: 400 })
	}

	// Auth check (reads from session, very cheap)
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch project and folder data
	const [project, folder] = await Promise.all([
		getProject(projectId, user.id),
		getSceneFolder(folderId, user.id)
	])

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	if (!folder) {
		throw new Response('Folder not found', { status: 404 })
	}

	// Fetch subfolders and scenes in parallel
	const [subfolders, scenes] = await Promise.all([
		getChildFolders(folderId, user.id),
		getFolderScenes(folderId, user.id)
	])

	return {
		user,
		userWithDefaults,
		project,
		folder,
		subfolders,
		scenes
	}
}

export function HydrateFallback() {
	return <FolderContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const FolderPage = ({ loaderData }: Route.ComponentProps) => {
	const { project, folder, subfolders, scenes } = loaderData
	const { setSelectedRows, runContentAction, actionState } =
		useDashboardSceneActions()
	const projectId = project.id
	const [renameRow, setRenameRow] = useState<ContentRow | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const [deleteRow, setDeleteRow] = useState<ContentRow | null>(null)
	const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false)
	const [newFolderName, setNewFolderName] = useState('')
	const [newFolderDescription, setNewFolderDescription] = useState('')

	const folderContent = {
		subfolders,
		scenes
	}

	const contentRows = useMemo<ContentRow[]>(() => {
		const folderRows: ContentRow[] = subfolders.map((subfolder) => ({
			id: subfolder.id,
			type: 'folder',
			name: subfolder.name,
			description: subfolder.description || undefined,
			projectId,
			projectName: project.name,
			updatedAt: subfolder.updatedAt
		}))

		const sceneRows: ContentRow[] = scenes.map((scene) => ({
			id: scene.id,
			type: 'scene',
			name: scene.name,
			description: scene.description || undefined,
			projectId: scene.projectId,
			projectName: project.name,
			folderId: scene.folderId,
			status: scene.status,
			updatedAt: scene.updatedAt
		}))

		return [...folderRows, ...sceneRows]
	}, [subfolders, scenes, projectId, project.name])

	const contentColumns = useMemo(
		() =>
			createContentColumns({
				onRenameItem: (row) => {
					setRenameRow(row)
					setRenameValue(row.name)
				},
				onDeleteItem: (row) => {
					setDeleteRow(row)
				}
			}),
		[]
	)

	useEffect(() => {
		setSelectedRows([])
		return () => {
			setSelectedRows([])
		}
	}, [setSelectedRows])

	return (
		<>
			<Dialog
				open={Boolean(renameRow)}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setRenameRow(null)
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Rename {renameRow?.type === 'folder' ? 'Folder' : 'Scene'}
						</DialogTitle>
						<DialogDescription>
							Update the {renameRow?.type === 'folder' ? 'folder' : 'scene'}{' '}
							name.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={renameValue}
						onChange={(event) => setRenameValue(event.target.value)}
						placeholder="Item name"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRenameRow(null)}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (!renameRow) {
									return
								}

								const nextName = renameValue.trim()
								if (!nextName) {
									return
								}

								runContentAction('rename', {
									items: [renameRow],
									name: nextName
								})
								setRenameRow(null)
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(deleteRow)}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setDeleteRow(null)
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {deleteRow?.type === 'folder' ? 'Folder' : 'Scene'}
						</AlertDialogTitle>
						<AlertDialogDescription>
							Delete "{deleteRow?.name}"? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (!deleteRow) {
									return
								}
								runContentAction('delete', { items: [deleteRow] })
								setDeleteRow(null)
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={createFolderDialogOpen}
				onOpenChange={setCreateFolderDialogOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Subfolder</DialogTitle>
						<DialogDescription>
							Enter a name for your new subfolder.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={newFolderName}
						onChange={(event) => setNewFolderName(event.target.value)}
						placeholder="Subfolder name"
					/>
					<Textarea
						value={newFolderDescription}
						onChange={(event) => setNewFolderDescription(event.target.value)}
						placeholder="Subfolder description (optional)"
					/>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setCreateFolderDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={actionState !== 'idle'}
							onClick={() => {
								const folderName = newFolderName.trim()

								runContentAction('create-folder', {
									projectId,
									parentFolderId: folder.id,
									name: folderName,
									description: newFolderDescription
								})
								setCreateFolderDialogOpen(false)
								setNewFolderName('')
								setNewFolderDescription('')
							}}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div className="space-y-6 p-6">
				{folderContent.subfolders.length > 0 ||
				folderContent.scenes.length > 0 ? (
					<DataTable
						columns={contentColumns}
						data={contentRows}
						searchKey="name"
						searchPlaceholder="Search content..."
						selectionActions={[
							{
								label: 'Rename Item',
								onClick: (rows) => {
									if (rows.length !== 1) {
										toast.error('Select exactly one item to rename')
										return
									}
									const selectedRow = rows[0] as ContentRow
									setRenameRow(selectedRow)
									setRenameValue(selectedRow.name)
								},
								disabled: (rows) => rows.length !== 1
							},
							{
								label: 'Delete Item',
								onClick: (rows) => {
									if (rows.length === 0) {
										toast.error('Select at least one item to delete')
										return
									}
									runContentAction('delete', { items: rows as ContentRow[] })
								},
								disabled: (rows) => rows.length === 0
							}
						]}
						onDelete={(selectedRows) => {
							runContentAction('delete', {
								items: selectedRows as ContentRow[]
							})
						}}
						onSelectionChange={(selectedRows) => {
							setSelectedRows(
								(selectedRows as ContentRow[]).map((row) => ({
									id: row.id,
									type: row.type,
									name: row.name,
									projectId: row.projectId,
									folderId: row.folderId
								}))
							)
						}}
						getRowCanSelect={() => true}
					/>
				) : (
					<Empty>
						<EmptyMedia>
							<FolderSearch className="text-primary/60 mx-auto h-12 w-12" />
						</EmptyMedia>
						<EmptyHeader>
							<EmptyTitle>Folder is empty</EmptyTitle>
							<EmptyDescription>
								This folder does not contain any subfolders or scenes yet.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent></EmptyContent>
					</Empty>
				)}
			</div>
		</>
	)
}

export default FolderPage
