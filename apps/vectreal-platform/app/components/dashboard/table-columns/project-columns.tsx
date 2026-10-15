import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { Ellipsis, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { Link, useLocation } from 'react-router'

import { DESTRUCTIVE_MENU_ITEM } from './destructive-menu-item'
import { formatShortDate } from '../../../constants/limit-format'
import { useIsClientMounted } from '../../../hooks/use-is-client-mounted'
import { describeDashboardOperationRequirement } from '../../../lib/domain/dashboard/dashboard-operations'
import { createCheckboxColumn, SortableHeader } from '../data-table'
import { StatusBreakdown, type SceneStatusCounts } from '../status-breakdown'

import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'

export interface ProjectRow {
	id: string
	name: string
	organizationName: string
	canDelete: boolean
	sceneCount: number
	counts: SceneStatusCounts
	/**
	 * Null when the project has no scenes.
	 *
	 * `projects` has no timestamp column of its own, so both dates are derived
	 * from the project's scenes. The derivation used to fall back to `new Date()`,
	 * which made every empty project report as updated today - a date the system
	 * invented rather than recorded.
	 */
	updatedAt: Date | null
}

interface ProjectColumnsOptions {
	onDeleteItem?: (row: ProjectRow) => void
	isActionsDisabled?: boolean
}

const ProjectActionsCell = memo(function ProjectActionsCell({
	row,
	onDeleteItem,
	isActionsDisabled
}: {
	row: ProjectRow
	onDeleteItem?: (row: ProjectRow) => void
	isActionsDisabled?: boolean
}) {
	const isClientMounted = useIsClientMounted()
	const location = useLocation()

	// `ProjectRow` has carried `canDelete` all along; the old cell ignored it and
	// offered no delete to anyone.
	const canDelete = row.canDelete && Boolean(onDeleteItem)

	const trigger = (
		<Button
			variant="ghost"
			size="sm"
			aria-label="Project actions"
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
						<DropdownMenuItem asChild>
							<Link
								/*
								  The search carries the list's view, filters and page. A bare
								  pathname here dropped all of it, so opening the drawer from
								  the table flipped the list behind it back to cards.
								*/
								to={{
									pathname: `/dashboard/projects/edit/${row.id}`,
									search: location.search
								}}
								className="flex w-full items-center gap-2"
							>
								<Pencil className="mr-2 h-4 w-4" />
								Edit project
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={!canDelete || isActionsDisabled}
							onClick={() => onDeleteItem?.(row)}
							className={DESTRUCTIVE_MENU_ITEM}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete project
						</DropdownMenuItem>
						{!row.canDelete ? (
							<p className="text-muted-foreground px-2 py-1.5 text-xs">
								{describeDashboardOperationRequirement('project:delete')}
							</p>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				trigger
			)}
		</div>
	)
})

/**
 * A factory rather than a constant, matching `createContentColumns`, because
 * the actions cell now needs handlers from the route. The two idioms sitting
 * side by side was the reason project rows had no delete at all.
 */
export function createProjectColumns({
	onDeleteItem,
	isActionsDisabled
}: ProjectColumnsOptions = {}): ColumnDef<ProjectRow>[] {
	return [
		createCheckboxColumn<ProjectRow>(),
		{
			accessorKey: 'name',
			header: ({ column }) => (
				<SortableHeader column={column}>Name</SortableHeader>
			),
			cell: ({ row }) => (
				<Link
					to={`/dashboard/projects/${row.original.id}`}
					state={{
						name: row.original.name,
						description: `Slug: ${row.original.name}`,
						type: 'project' as const
					}}
					viewTransition
					className="group flex items-center gap-2 font-medium hover:underline"
				>
					<FolderOpen className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
					{row.getValue('name')}
				</Link>
			)
		},
		{
			accessorKey: 'organizationName',
			header: ({ column }) => (
				<SortableHeader column={column}>Organization</SortableHeader>
			),
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm">
					{row.getValue('organizationName')}
				</span>
			)
		},
		{
			accessorKey: 'sceneCount',
			header: ({ column }) => (
				<SortableHeader column={column}>Scenes</SortableHeader>
			),
			// Sorts on the count, reads as the breakdown. "12 scenes" never answered
			// the question people have about a project, which is how much of it is live.
			cell: ({ row }) => (
				<StatusBreakdown counts={row.original.counts} verbose />
			)
		},
		{
			accessorKey: 'updatedAt',
			header: ({ column }) => (
				<SortableHeader column={column}>Last Updated</SortableHeader>
			),
			cell: ({ row }) => {
				const date = row.original.updatedAt

				return (
					<span className="text-muted-foreground text-sm">
						{date ? formatShortDate(date) : 'Never'}
					</span>
				)
			}
		},
		{
			id: 'actions',
			cell: ({ row }) => (
				<ProjectActionsCell
					row={row.original}
					onDeleteItem={onDeleteItem}
					isActionsDisabled={isActionsDisabled}
				/>
			)
		}
	]
}
