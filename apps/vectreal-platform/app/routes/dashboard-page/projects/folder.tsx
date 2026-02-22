import { useSetAtom } from 'jotai/react'
import { FolderSearch } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { ShouldRevalidateFunction } from 'react-router'

import { DataTable } from '../../../components/dashboard/data-table'
import {
	createContentColumns,
	type ContentRow
} from '../../../components/dashboard/project-table-columns'
import { FolderContentSkeleton } from '../../../components/skeletons'
import { useDashboardSceneActions } from '../../../hooks/use-dashboard-scene-actions'
import { useDashboardTableState } from '../../../hooks/use-dashboard-table-state'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	deleteDialogAtom,
	renameDialogAtom
} from '../../../lib/stores/dashboard-management-store'
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

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

	return defaultShouldRevalidate
}

export function HydrateFallback() {
	return <FolderContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const FolderPage = ({ loaderData }: Route.ComponentProps) => {
	const { project, subfolders, scenes } = loaderData
	const { setSelectedRows, isTableBusy, pendingItemIds } =
		useDashboardSceneActions()
	const setRenameDialog = useSetAtom(renameDialogAtom)
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
	const projectId = project.id
	const tableState = useDashboardTableState({
		namespace: 'folder-content'
	})

	const folderContent = {
		subfolders,
		scenes
	}
	const pendingItemIdSet = useMemo(
		() => new Set(pendingItemIds),
		[pendingItemIds]
	)

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
				pendingItemIds: pendingItemIdSet,
				isActionsDisabled: isTableBusy,
				onRenameItem: (row) => {
					setRenameDialog({
						open: true,
						item: {
							id: row.id,
							type: row.type,
							name: row.name,
							projectId: row.projectId,
							folderId: row.folderId
						},
						name: row.name
					})
				},
				onDeleteItem: (row) => {
					setDeleteDialog({
						open: true,
						items: [
							{
								id: row.id,
								type: row.type,
								name: row.name,
								projectId: row.projectId,
								folderId: row.folderId
							}
						]
					})
				}
			}),
		[isTableBusy, pendingItemIdSet, setDeleteDialog, setRenameDialog]
	)

	useEffect(() => {
		setSelectedRows([])
		return () => {
			setSelectedRows([])
		}
	}, [setSelectedRows])

	return (
		<>
			<div className="space-y-6 p-6">
				{folderContent.subfolders.length > 0 ||
				folderContent.scenes.length > 0 ? (
					<DataTable
						columns={contentColumns}
						data={contentRows}
						isUpdating={isTableBusy}
						disableSelectionActions={isTableBusy}
						searchKey="name"
						searchPlaceholder="Search content..."
						searchValue={tableState.searchValue}
						onSearchValueChange={tableState.setSearchValue}
						sorting={tableState.sorting}
						onSortingChange={tableState.onSortingChange}
						pagination={tableState.pagination}
						onPaginationChange={tableState.onPaginationChange}
						rowSelection={tableState.rowSelection}
						onRowSelectionChange={tableState.onRowSelectionChange}
						onRename={(selectedRow) => {
							setRenameDialog({
								open: true,
								item: {
									id: selectedRow.id,
									type: selectedRow.type,
									name: selectedRow.name,
									projectId: selectedRow.projectId,
									folderId: selectedRow.folderId
								},
								name: selectedRow.name
							})
						}}
						onDelete={(selectedRows) => {
							setDeleteDialog({
								open: true,
								items: (selectedRows as ContentRow[]).map((row) => ({
									id: row.id,
									type: row.type,
									name: row.name,
									projectId: row.projectId,
									folderId: row.folderId
								}))
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
