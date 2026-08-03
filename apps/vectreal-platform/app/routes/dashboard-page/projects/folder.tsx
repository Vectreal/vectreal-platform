import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle
} from '@shared/components/ui/empty'
import { useSetAtom } from 'jotai/react'
import { FolderSearch } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { data } from 'react-router'

import { Route } from './+types/folder'
import {
	DataTable,
	createContentColumns,
	type ContentRow
} from '../../../components/dashboard'
import { FolderContentSkeleton } from '../../../components/skeletons'
import { useDashboardMutationStatus } from '../../../hooks/use-dashboard-mutations'
import { useDashboardTableState } from '../../../hooks/use-dashboard-table-state'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import { toContentRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getChildFolders,
	getSceneFolderChildCounts,
	getFolderScenes,
	getSceneFolder,
	getSceneFolderAncestry
} from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { shouldRevalidateForRouteParams } from '../../../lib/navigation/dashboard-route-behavior'
import {
	deleteDialogAtom,
	moveDialogAtom,
	renameDialogAtom,
	selectedRowsAtom
} from '../../../lib/stores/dashboard-management-store'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId
	const folderId = params.folderId

	if (!projectId || !folderId) {
		throw new Response('Project ID and Folder ID are required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedSession(request)

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

	// Fetch folder content and ancestry in parallel
	const [subfolders, scenes, folderPath] = await Promise.all([
		getChildFolders(folderId, user.id),
		getFolderScenes(folderId, user.id),
		getSceneFolderAncestry(folderId, user.id)
	])

	const subfolderChildCounts = await getSceneFolderChildCounts(
		subfolders.map((subfolder) => subfolder.id)
	)

	return data(
		{
			user,
			project,
			folder,
			folderPath,
			subfolders: subfolders.map((subfolder) => ({
				...subfolder,
				childCount: subfolderChildCounts.get(subfolder.id) ?? 0
			})),
			scenes
		},
		{ headers }
	)
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentParams,
	nextParams,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	return shouldRevalidateForRouteParams({
		currentParams,
		nextParams,
		paramKeys: ['projectId', 'folderId'],
		formMethod,
		actionResult,
		defaultShouldRevalidate
	})
}

export function HydrateFallback() {
	return <FolderContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const FolderPage = ({ loaderData }: Route.ComponentProps) => {
	const { project, subfolders, scenes } = loaderData
	const setSelectedRows = useSetAtom(selectedRowsAtom)
	const { isBusy: isTableBusy, pendingIds } = useDashboardMutationStatus()
	const setRenameDialog = useSetAtom(renameDialogAtom)
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
	const setMoveDialog = useSetAtom(moveDialogAtom)
	const projectId = project.id
	const tableState = useDashboardTableState({
		namespace: 'folder-content'
	})

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
			childCount: subfolder.childCount,
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
				pendingItemIds: pendingIds,
				isActionsDisabled: isTableBusy,
				onRenameItem: (row) => {
					setRenameDialog({
						open: true,
						item: toContentRef(row),
						name: row.name
					})
				},
				onMoveItem: (row) => {
					setMoveDialog({
						open: true,
						items: [toContentRef(row)],
						projectId: row.projectId
					})
				},
				onDeleteItem: (row) => {
					setDeleteDialog({
						open: true,
						items: [toContentRef(row)]
					})
				}
			}),
		[isTableBusy, pendingIds, setDeleteDialog, setMoveDialog, setRenameDialog]
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
								item: toContentRef(selectedRow),
								name: selectedRow.name
							})
						}}
						onMove={(selectedRows) => {
							setMoveDialog({
								open: true,
								items: (selectedRows as ContentRow[]).map(toContentRef),
								projectId
							})
						}}
						onDelete={(selectedRows) => {
							setDeleteDialog({
								open: true,
								items: (selectedRows as ContentRow[]).map(toContentRef)
							})
						}}
						onSelectionChange={(selectedRows) => {
							setSelectedRows((selectedRows as ContentRow[]).map(toContentRef))
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
