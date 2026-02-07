/**
 * Column definitions for project and scene data tables
 */

import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, File, FolderOpen } from 'lucide-react'
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
	},
	{
		id: 'actions',
		cell: ({ row }) => (
			<Link to={`/dashboard/projects/${row.original.id}`} viewTransition>
				<Button variant="ghost" size="sm">
					<ExternalLink className="h-4 w-4" />
				</Button>
			</Link>
		)
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
	},
	{
		id: 'actions',
		cell: ({ row }) => (
			<Link
				to={`/dashboard/projects/${row.original.projectId}/${row.original.id}`}
				viewTransition
			>
				<Button variant="ghost" size="sm">
					<ExternalLink className="h-4 w-4" />
				</Button>
			</Link>
		)
	}
]
