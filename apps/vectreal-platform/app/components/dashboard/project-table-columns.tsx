/**
 * Column definitions for project and scene data tables
 */

import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import type { ColumnDef } from '@tanstack/react-table'
import { Ellipsis, File, FilePenLine, FolderOpen, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { createCheckboxColumn, SortableHeader } from './data-table'

/**
 * Project table columns
 */
export interface ProjectRow {
	id: string
	name: string
	organizationName: string
	sceneCount: number
	createdAt: Date
	updatedAt: Date
}

export const projectColumns: ColumnDef<ProjectRow>[] = [
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
				<FolderOpen className="text-primary/60 group-hover:text-primary h-4 w-4 transition-colors" />
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
		cell: ({ row }) => (
			<Badge variant="secondary">{row.getValue('sceneCount')} scenes</Badge>
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
					{new Date(date).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})}
				</span>
			)
		}
	}
]

/**
 * Scene table columns
 */
export interface SceneRow {
	id: string
	name: string
	description?: string
	projectId: string
	projectName: string
	status: string
	thumbnailUrl?: string
	updatedAt: Date
}

export interface ContentRow {
	id: string
	type: 'scene' | 'folder'
	name: string
	description?: string
	projectId: string
	projectName: string
	folderId?: string | null
	status?: string
	updatedAt: Date
}

interface ContentColumnsOptions {
	onRenameItem?: (row: ContentRow) => void
	onDeleteItem?: (row: ContentRow) => void
}

export const sceneColumns: ColumnDef<SceneRow>[] = [
	createCheckboxColumn<SceneRow>(),
	{
		accessorKey: 'name',
		header: ({ column }) => (
			<SortableHeader column={column}>Name</SortableHeader>
		),
		cell: ({ row }) => (
			<Link
				to={`/dashboard/projects/${row.original.projectId}/${row.original.id}`}
				state={{
					name: row.original.name,
					description: row.original.description || undefined,
					projectName: row.original.projectName,
					type: 'scene' as const
				}}
				viewTransition
				className="group flex items-center gap-2 font-medium hover:underline"
			>
				<File className="text-primary/60 group-hover:text-primary h-4 w-4 transition-colors" />
				{row.getValue('name')}
			</Link>
		)
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
		accessorKey: 'projectName',
		header: ({ column }) => (
			<SortableHeader column={column}>Project</SortableHeader>
		),
		cell: ({ row }) => (
			<span className="text-muted-foreground text-sm">
				{row.getValue('projectName')}
			</span>
		)
	},
	{
		accessorKey: 'status',
		header: ({ column }) => (
			<SortableHeader column={column}>Status</SortableHeader>
		),
		cell: ({ row }) => {
			const status = row.getValue('status') as string
			return (
				<Badge variant={status === 'published' ? 'default' : 'secondary'}>
					{status}
				</Badge>
			)
		}
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
					{new Date(date).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})}
				</span>
			)
		}
	}
]

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
							<FolderOpen className="text-primary/60 group-hover:text-primary h-4 w-4 transition-colors" />
						) : (
							<File className="text-primary/60 group-hover:text-primary h-4 w-4 transition-colors" />
						)}
						{row.getValue('name')}
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
			cell: ({ row }) => (
				<Badge variant="secondary">
					{row.original.type === 'folder'
						? 'Folder'
						: row.original.status || 'Scene'}
				</Badge>
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
						{new Date(date).toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
					</span>
				)
			}
		},
		{
			id: 'actions',
			cell: ({ row }) => {
				return (
					<div className="flex items-center justify-end gap-1">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" aria-label="Item actions">
									<Ellipsis className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => options.onRenameItem?.(row.original)}
								>
									<FilePenLine className="mr-2 h-4 w-4" />
									Rename
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => options.onDeleteItem?.(row.original)}
									className="text-destructive-foreground hover:bg-destructive/50 focus:bg-destructive/50"
								>
									<Trash2 className="mr-2 h-4 w-4 text-inherit" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)
			}
		}
	]
}
