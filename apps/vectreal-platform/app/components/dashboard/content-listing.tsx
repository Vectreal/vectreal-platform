import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle
} from '@shared/components/ui/empty'
import { useSetAtom } from 'jotai/react'
import { FolderOpen } from 'lucide-react'
import { useMemo } from 'react'

import { DataTable } from './data-table'
import { createContentColumns, type ContentRow } from './table-columns'
import { useDashboardMutationStatus } from '../../hooks/use-dashboard-mutations'
import { useDashboardTableState } from '../../hooks/use-dashboard-table-state'
import { toContentRef } from '../../lib/domain/dashboard/dashboard-confirmation'
import {
	deleteDialogAtom,
	moveDialogAtom,
	renameDialogAtom
} from '../../lib/stores/dashboard-management-store'

/**
 * What a container holds: its folders and its scenes, as one table.
 *
 * A project and a folder are the same page. Both list folders and scenes from
 * the same two tables, through the same columns, into the same table shell,
 * with the same three dialogs behind the same three row actions - and until
 * this component existed, both wrote all of it out. The two route files were
 * identical from the row mapping to the closing tag of `DataTable`, differing
 * only in whether the folders were called `folders` or `subfolders`.
 *
 * They had already drifted where the copies were free to. The empty state was
 * the visible half: one page put its heading straight into `EmptyHeader`, so it
 * rendered at body size while the other's `EmptyTitle` rendered at the h3 rung,
 * and the folder's carried an `EmptyContent` element with nothing in it. The
 * skeletons were the other half - two components, byte-identical apart from
 * drawing six placeholder rows against five.
 *
 * The empty state is the house shape from `organizations.tsx`: media, title and
 * description inside `EmptyHeader`, at `variant="icon"` rather than a
 * hand-picked icon size (the two copies disagreed there too, at 96px and 48px).
 * `FolderSearch` was wrong on both - nothing has been searched. A search that
 * matches nothing is `DataTable`'s own "No results found"; this fires when the
 * container is genuinely empty.
 */

/** The folder fields a row needs. Loaders may hold more; this reads five. */
export interface ContentListingFolder {
	id: string
	name: string
	description: string | null
	childCount: number
	updatedAt: Date
}

/** The scene fields a row needs. */
export interface ContentListingScene {
	id: string
	name: string
	description: string | null
	projectId: string
	folderId: string | null
	status: ContentRow['status']
	updatedAt: Date
}

interface ContentListingProps {
	folders: readonly ContentListingFolder[]
	scenes: readonly ContentListingScene[]
	/** The project the container belongs to; a folder's rows carry it too. */
	projectId: string
	projectName: string
	/**
	 * Prefix for the search, sort and pagination keys this listing writes to the
	 * URL. Distinct per container so a filtered project does not hand its query
	 * string to a folder.
	 */
	namespace: string
}

export function ContentListing({
	folders,
	scenes,
	projectId,
	projectName,
	namespace
}: ContentListingProps) {
	const { isBusy: isTableBusy, pendingIds } = useDashboardMutationStatus()
	const setRenameDialog = useSetAtom(renameDialogAtom)
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
	const setMoveDialog = useSetAtom(moveDialogAtom)
	const tableState = useDashboardTableState({ namespace })

	const contentRows = useMemo<ContentRow[]>(() => {
		const folderRows: ContentRow[] = folders.map((folder) => ({
			id: folder.id,
			type: 'folder',
			name: folder.name,
			description: folder.description || undefined,
			projectId,
			projectName,
			childCount: folder.childCount,
			updatedAt: folder.updatedAt
		}))

		const sceneRows: ContentRow[] = scenes.map((scene) => ({
			id: scene.id,
			type: 'scene',
			name: scene.name,
			description: scene.description || undefined,
			projectId: scene.projectId,
			projectName,
			folderId: scene.folderId,
			status: scene.status,
			updatedAt: scene.updatedAt
		}))

		return [...folderRows, ...sceneRows]
	}, [folders, scenes, projectId, projectName])

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

	return (
		<div className="space-y-6 py-6">
			{contentRows.length > 0 ? (
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
					getRowCanSelect={() => true}
				/>
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FolderOpen />
						</EmptyMedia>
						<EmptyTitle>Nothing here yet</EmptyTitle>
						<EmptyDescription>
							Upload a model or create a folder to get started.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	)
}
