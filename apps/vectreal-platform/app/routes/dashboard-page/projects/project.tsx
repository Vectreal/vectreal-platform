import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia
} from '@shared/components/ui/empty'
import { useSetAtom } from 'jotai/react'
import { FolderSearch } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Outlet, useLoaderData, useLocation } from 'react-router'

import { Route } from './+types/project'
import { DataTable } from '../../../components/dashboard/data-table'
import {
	createContentColumns,
	type ContentRow
} from '../../../components/dashboard/project-table-columns'
import { ProjectContentSkeleton } from '../../../components/skeletons'
import { useDashboardSceneActions } from '../../../hooks/use-dashboard-scene-actions'
import { useDashboardTableState } from '../../../hooks/use-dashboard-table-state'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getRootSceneFolders,
	getRootScenes
} from '../../../lib/domain/scene/scene-folder-repository.server'
import {
	deleteDialogAtom,
	renameDialogAtom
} from '../../../lib/stores/dashboard-management-store'

import type { ShouldRevalidateFunction } from 'react-router'

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
	return <ProjectContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectPage = () => {
	const location = useLocation()
	const { project, folders, scenes } = useLoaderData<typeof loader>()
	const { setSelectedRows, isTableBusy, pendingItemIds } =
		useDashboardSceneActions()
	const setRenameDialog = useSetAtom(renameDialogAtom)
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
	const projectId = project.id
	const tableState = useDashboardTableState({
		namespace: 'project-content'
	})

	const projectContent = {
		folders,
		scenes
	}
	const pendingItemIdSet = useMemo(
		() => new Set(pendingItemIds),
		[pendingItemIds]
	)

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
				{projectContent.folders.length > 0 ||
				projectContent.scenes.length > 0 ? (
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
