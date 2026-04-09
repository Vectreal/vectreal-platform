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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import {
	Box,
	Ban,
	CheckCircle2,
	Clock,
	Ellipsis,
	File,
	FilePenLine,
	FolderOpen,
	KeyRound,
	Pencil,
	Trash2,
	XCircle,
	Eye,
	Rocket,
	ArrowRight
} from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { Link } from 'react-router'

import { createCheckboxColumn, SortableHeader } from './data-table'

import type { ColumnDef } from '@tanstack/react-table'

/**
 * Project table columns
 */
export interface ProjectRow {
	id: string
	name: string
	organizationName: string
	canDelete: boolean
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
	},
	{
		id: 'actions',
		cell: ({ row }) => (
			<div className="flex items-center justify-end gap-1">
				<Link to={`/dashboard/projects/${row.original.id}/edit`}>
					<Button variant="ghost" size="sm" aria-label="Edit project">
						<Pencil className="h-4 w-4" />
					</Button>
				</Link>
			</div>
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
	pendingItemIds?: ReadonlySet<string>
	isActionsDisabled?: boolean
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
	},
	{
		id: 'actions',
		cell: ({ row }) => <SceneActionsCell row={row.original} />
	}
]

const SceneActionsCell = memo(({ row }: { row: SceneRow }) => {
	const [isClientMounted, setIsClientMounted] = useState(false)
	useEffect(() => setIsClientMounted(true), [])

	const trigger = (
		<Button variant="ghost" size="sm" aria-label="Scene actions" disabled={!isClientMounted}>
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
								to={`/dashboard/projects/${row.projectId}/${row.id}`}
								state={{
									name: row.name,
									description: row.description || undefined,
									projectName: row.projectName,
									type: 'scene' as const
								}}
								viewTransition
								className="flex w-full items-center gap-2"
							>
								<ArrowRight className="mr-2 h-4 w-4" />
								Go to Scene Details
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link
								to={`/publisher/${row.id}`}
								viewTransition
								className="flex w-full items-center gap-2"
							>
								<Rocket className="mr-2 h-4 w-4" />
								Edit in Publisher
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link
								to={`/preview/fullscreen/${row.projectId}/${row.id}/`}
								state={{
									name: row.name,
									description: row.description || undefined,
									projectName: row.projectName,
									type: 'scene' as const
								}}
								viewTransition
								className="flex w-full items-center gap-2"
							>
								<Eye className="mr-2 h-4 w-4" />
								Preview Scene
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				trigger
			)}
		</div>
	)
})

interface ContentActionsCellProps {
	row: ContentRow
	onRenameItem?: (row: ContentRow) => void
	onDeleteItem?: (row: ContentRow) => void
	isActionsDisabled?: boolean
}

const ContentActionsCell = memo(function ContentActionsCell({
	row,
	onRenameItem,
	onDeleteItem,
	isActionsDisabled
}: ContentActionsCellProps) {
	const [isClientMounted, setIsClientMounted] = useState(false)
	useEffect(() => setIsClientMounted(true), [])
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
						<DropdownMenuItem
							disabled={isActionsDisabled}
							onClick={() => onDeleteItem?.(row)}
							className="text-destructive-foreground hover:bg-destructive/50 focus:bg-destructive/50"
						>
							<Trash2 className="mr-2 h-4 w-4 text-inherit" />
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

interface ApiKeyActionsCellProps {
	row: ApiKeyRow
	onEdit: (keyId: string) => void
	onRevoke: (keyId: string) => void
}

const ApiKeyActionsCell = memo(function ApiKeyActionsCell({
	row,
	onEdit,
	onRevoke
}: ApiKeyActionsCellProps) {
	const [isClientMounted, setIsClientMounted] = useState(false)
	useEffect(() => setIsClientMounted(true), [])
	const trigger = (
		<Button
			variant="ghost"
			size="sm"
			aria-label="API key actions"
			disabled={!isClientMounted}
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
						<DropdownMenuItem onClick={() => onEdit(row.id)}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={Boolean(row.revokedAt)}
							onClick={() => onRevoke(row.id)}
							className="text-destructive-foreground hover:bg-destructive/50 focus:bg-destructive/50"
						>
							<KeyRound className="mr-2 h-4 w-4 text-inherit" />
							Revoke
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
							<FolderOpen className="text-primary/60 group-hover:text-primary h-4 w-4 transition-colors" />
						) : (
							<Box className="text-primary/60 group-hover:text-primary h-4 w-4 transition-colors" />
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
			cell: ({ row }) => (
				<ContentActionsCell
					row={row.original}
					onRenameItem={options.onRenameItem}
					onDeleteItem={options.onDeleteItem}
					isActionsDisabled={options.isActionsDisabled}
				/>
			)
		}
	]
}

export interface ApiKeyRow {
	id: string
	name: string
	description?: string | null
	keyPreview: string
	createdBy: string
	projects: Array<{
		id: string
		name: string
		slug: string
	}>
	lastUsedAt: Date | null
	active: boolean | null
	expiresAt: Date | null
	revokedAt: Date | null
}

interface ApiKeyColumnsOptions {
	onEdit: (keyId: string) => void
	onRevoke: (keyId: string) => void
}

function getApiKeyStatus(row: ApiKeyRow): {
	label: string
	variant: 'default' | 'secondary' | 'destructive' | 'outline'
	icon: 'revoked' | 'expired' | 'active' | 'inactive'
} {
	if (row.revokedAt) {
		return { label: 'Revoked', variant: 'destructive', icon: 'revoked' }
	}

	if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
		return { label: 'Expired', variant: 'outline', icon: 'expired' }
	}

	if (row.active) {
		return { label: 'Active', variant: 'default', icon: 'active' }
	}

	return { label: 'Inactive', variant: 'secondary', icon: 'inactive' }
}

function formatRelativeTime(date: Date | null): string {
	if (!date) return 'Never'

	const now = new Date()
	const diff = now.getTime() - new Date(date).getTime()
	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) return `${days}d ago`
	if (hours > 0) return `${hours}h ago`
	if (minutes > 0) return `${minutes}m ago`
	return 'Just now'
}

export function createApiKeyColumns(
	options: ApiKeyColumnsOptions
): ColumnDef<ApiKeyRow>[] {
	return [
		createCheckboxColumn<ApiKeyRow>(),
		{
			accessorKey: 'name',
			header: ({ column }) => (
				<SortableHeader column={column}>Name</SortableHeader>
			),
			cell: ({ row }) => (
				<div className="flex min-w-0 flex-col gap-1">
					<div className="flex items-center gap-2">
						<span className="font-medium">{row.original.name}</span>
						<code className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
							...{row.original.keyPreview}
						</code>
					</div>
					{row.original.description && (
						<span className="text-muted-foreground text-sm">
							{row.original.description}
						</span>
					)}
				</div>
			)
		},
		{
			accessorKey: 'createdBy',
			header: ({ column }) => (
				<SortableHeader column={column}>Created By</SortableHeader>
			),
			cell: ({ row }) => (
				<span className="text-sm">{row.original.createdBy}</span>
			)
		},
		{
			id: 'projects',
			header: 'Projects',
			cell: ({ row }) => {
				const projects = row.original.projects

				if (projects.length === 0) {
					return (
						<span className="text-muted-foreground text-sm">No projects</span>
					)
				}

				return (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex flex-wrap gap-1">
									{projects.slice(0, 2).map((project) => (
										<Badge
											key={project.id}
											variant="secondary"
											className="text-xs"
										>
											{project.name}
										</Badge>
									))}
									{projects.length > 2 && (
										<Badge variant="outline" className="text-xs">
											+{projects.length - 2}
										</Badge>
									)}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								<div className="flex flex-col gap-1">
									{projects.map((project) => (
										<div key={project.id} className="text-sm">
											{project.name}
										</div>
									))}
								</div>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)
			}
		},
		{
			id: 'lastUsedAt',
			header: ({ column }) => (
				<SortableHeader column={column}>Last Used</SortableHeader>
			),
			accessorFn: (row) => row.lastUsedAt ?? new Date(0),
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm">
					{formatRelativeTime(row.original.lastUsedAt)}
				</span>
			)
		},
		{
			id: 'status',
			header: ({ column }) => (
				<SortableHeader column={column}>Status</SortableHeader>
			),
			accessorFn: (row) => getApiKeyStatus(row).label,
			cell: ({ row }) => {
				const status = getApiKeyStatus(row.original)
				const StatusIcon =
					status.icon === 'revoked'
						? XCircle
						: status.icon === 'expired'
							? Clock
							: status.icon === 'active'
								? CheckCircle2
								: Ban

				return (
					<Badge variant={status.variant} className="gap-1">
						<StatusIcon className="size-3" />
						{status.label}
					</Badge>
				)
			}
		},
		{
			id: 'actions',
			cell: ({ row }) => (
				<ApiKeyActionsCell
					row={row.original}
					onEdit={options.onEdit}
					onRevoke={options.onRevoke}
				/>
			)
		}
	]
}
