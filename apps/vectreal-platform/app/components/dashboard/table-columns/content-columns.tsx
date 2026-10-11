import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import {
	Box,
	Ellipsis,
	FilePenLine,
	FolderInput,
	FolderOpen,
	Trash2
} from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router'

import { DESTRUCTIVE_MENU_ITEM } from './destructive-menu-item'
import { formatShortDate } from '../../../constants/limit-format'
import { useIsClientMounted } from '../../../hooks/use-is-client-mounted'
import { createCheckboxColumn, SortableHeader } from '../data-table'
import { SceneStatusTag } from '../scene-status'

import type { SceneStatus } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'

export interface ContentRow {
	id: string
	type: 'scene' | 'folder'
	name: string
	description?: string
	projectId: string
	projectName: string
	folderId?: string | null
	/** Scenes only. `scenes.status` is an enum column, so this is its union. */
	status?: SceneStatus
	/** Folders only: contained scenes plus subfolders. Drives the delete tier. */
	childCount?: number
	updatedAt: Date
}

interface ContentColumnsOptions {
	onRenameItem?: (row: ContentRow) => void
	onMoveItem?: (row: ContentRow) => void
	onDeleteItem?: (row: ContentRow) => void
	pendingItemIds?: ReadonlySet<string>
	isActionsDisabled?: boolean
}

interface ContentActionsCellProps {
	row: ContentRow
	onRenameItem?: (row: ContentRow) => void
	onMoveItem?: (row: ContentRow) => void
	onDeleteItem?: (row: ContentRow) => void
	isActionsDisabled?: boolean
}

const ContentActionsCell = memo(function ContentActionsCell({
	row,
	onRenameItem,
	onMoveItem,
	onDeleteItem,
	isActionsDisabled
}: ContentActionsCellProps) {
	const isClientMounted = useIsClientMounted()
	const trigger = (
		<Button
			variant="ghost"
			size="sm"
			aria-label="Item actions"
			disabled={!isClientMounted || isActionsDisabled}
		>
			<Ellipsis className="h-4 w-4" />
		</Button>
	)
	return (
		<div className="flex items-center justify-end gap-1">
			{isClientMounted ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							disabled={isActionsDisabled}
							onClick={() => onRenameItem?.(row)}
						>
							<FilePenLine className="mr-2 h-4 w-4" />
							Rename
						</DropdownMenuItem>
						{onMoveItem ? (
							<DropdownMenuItem
								disabled={isActionsDisabled}
								onClick={() => onMoveItem(row)}
							>
								<FolderInput className="mr-2 h-4 w-4" />
								Move to...
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem
							disabled={isActionsDisabled}
							onClick={() => onDeleteItem?.(row)}
							className={DESTRUCTIVE_MENU_ITEM}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				trigger
			)}
		</div>
	)
})

export function createContentColumns(
	options: ContentColumnsOptions = {}
): ColumnDef<ContentRow>[] {
	return [
		createCheckboxColumn<ContentRow>(),
		{
			accessorKey: 'name',
			header: ({ column }) => (
				<SortableHeader column={column}>Name</SortableHeader>
			),
			cell: ({ row }) => {
				const isFolder = row.original.type === 'folder'
				const isUpdating = options.pendingItemIds?.has(row.original.id) ?? false
				const to = isFolder
					? `/dashboard/projects/${row.original.projectId}/folder/${row.original.id}`
					: `/dashboard/projects/${row.original.projectId}/${row.original.id}`

				return (
					<Link
						to={to}
						state={{
							name: row.original.name,
							description: row.original.description || undefined,
							projectName: row.original.projectName,
							type: row.original.type
						}}
						viewTransition
						className="group flex items-center gap-2 font-medium hover:underline"
					>
						{isFolder ? (
							<FolderOpen className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
						) : (
							<Box className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
						)}
						{row.getValue('name')}
						{isUpdating && (
							<span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs">
								<span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Updating
							</span>
						)}
					</Link>
				)
			}
		},
		{
			accessorKey: 'description',
			header: 'Description',
			cell: ({ row }) => (
				<span className="text-muted-foreground line-clamp-1 text-sm">
					{row.getValue('description') || 'No description'}
				</span>
			)
		},
		{
			accessorKey: 'type',
			header: ({ column }) => (
				<SortableHeader column={column}>Type</SortableHeader>
			),
			/*
			  A folder is a kind of thing; a scene's status is a state of one. One
			  grey pill said those were the same sort of fact and left every scene
			  status looking alike, archived included. The scene half speaks the
			  vocabulary `SceneStatusTag` owns.
			*/
			cell: ({ row }) =>
				row.original.type === 'folder' ? (
					<Badge variant="secondary">Folder</Badge>
				) : (
					<SceneStatusTag status={row.original.status ?? 'draft'} />
				)
		},
		{
			accessorKey: 'updatedAt',
			header: ({ column }) => (
				<SortableHeader column={column}>Last Updated</SortableHeader>
			),
			cell: ({ row }) => {
				const date = row.getValue('updatedAt') as Date
				return (
					<span className="text-muted-foreground text-sm">
						{formatShortDate(date)}
					</span>
				)
			}
		},
		{
			id: 'actions',
			cell: ({ row }) => (
				<ContentActionsCell
					row={row.original}
					onRenameItem={options.onRenameItem}
					onMoveItem={options.onMoveItem}
					onDeleteItem={options.onDeleteItem}
					isActionsDisabled={options.isActionsDisabled}
				/>
			)
		}
	]
}
