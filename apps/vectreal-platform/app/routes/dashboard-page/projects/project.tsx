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
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia
} from '@shared/components/ui/empty'
import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { FolderSearch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLoaderData, useLocation } from 'react-router'
import { toast } from 'sonner'

import { DataTable } from '../../../components/dashboard/data-table'
import {
	createContentColumns,
	type ContentRow
} from '../../../components/dashboard/project-table-columns'
import { ProjectContentSkeleton } from '../../../components/skeletons'
import { useDashboardSceneActions } from '../../../hooks/use-dashboard-scene-actions'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getRootSceneFolders,
	getRootScenes
} from '../../../lib/domain/scene/scene-folder-repository.server'

import { Route } from './+types/project'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	// Auth check (reads from session, very cheap)
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch project data
	const project = await getProject(projectId, user.id)

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	// Fetch root folders and root scenes in parallel
	const [folders, scenes] = await Promise.all([
		getRootSceneFolders(projectId, user.id),
		getRootScenes(projectId, user.id)
	])

	return {
		user,
		userWithDefaults,
		project,
		folders,
		scenes
	}
}

export function HydrateFallback() {
	return <ProjectContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectPage = () => {
	const location = useLocation()
	const { project, folders, scenes } = useLoaderData<typeof loader>()
	const {
		setSelectedRows,
		runContentAction,
		actionState
	} = useDashboardSceneActions()
	const projectId = project.id
	const [renameRow, setRenameRow] = useState<ContentRow | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const [deleteRow, setDeleteRow] = useState<ContentRow | null>(null)
	const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false)
	const [newFolderName, setNewFolderName] = useState('')
	const [newFolderDescription, setNewFolderDescription] = useState('')

	const projectContent = {
		folders,
		scenes
	}

	// Check if we're at a child route (folder or scene)
	// If so, only show the outlet content
	const isProjectDetailRoute =
		location.pathname === `/dashboard/projects/${projectId}`

	if (!isProjectDetailRoute) {
		return <Outlet />
	}

	const contentRows = useMemo<ContentRow[]>(() => {
		const folderRows: ContentRow[] = folders.map((folder) => ({
			id: folder.id,
			type: 'folder',
			name: folder.name,
			description: folder.description || undefined,
			projectId,
			projectName: project.name,
			updatedAt: folder.updatedAt
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
	}, [folders, scenes, projectId, project.name])

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
						<DialogTitle>Create Folder</DialogTitle>
						<DialogDescription>
							Enter a name for your new folder.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={newFolderName}
						onChange={(event) => setNewFolderName(event.target.value)}
						placeholder="Folder name"
					/>
					<Textarea
						value={newFolderDescription}
						onChange={(event) => setNewFolderDescription(event.target.value)}
						placeholder="Folder description (optional)"
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
				{projectContent.folders.length > 0 ||
				projectContent.scenes.length > 0 ? (
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
							void runContentAction('delete', {
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
							<FolderSearch className="text-muted-foreground h-24 w-24" />
						</EmptyMedia>
						<EmptyHeader>No content yet</EmptyHeader>
						<EmptyDescription>
							Start by creating your first scene or folder.
						</EmptyDescription>
					</Empty>
				)}
			</div>
		</>
	)
}

export default ProjectPage
