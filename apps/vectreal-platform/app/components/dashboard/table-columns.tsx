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
	FilePenLine,
	FolderInput,
	FolderOpen,
	KeyRound,
	Pencil,
	RefreshCw,
	Trash2,
	XCircle,
	Eye,
	Rocket,
	ArrowRight
} from 'lucide-react'
import { memo } from 'react'
import { Link, useLocation } from 'react-router'

import { createCheckboxColumn, SortableHeader } from './data-table'
import { SceneThumbnail } from './scene-thumbnail'
import { StatusBreakdown, type SceneStatusCounts } from './status-breakdown'
import { useIsClientMounted } from '../../hooks/use-is-client-mounted'
import {
	resolveApiKeyState,
	type ApiKeyLifecycleRow,
	type ApiKeyState
} from '../../lib/domain/auth/api-key-lifecycle'

import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'

/**
 * Project table columns
 */
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
	createdAt: Date | null
	updatedAt: Date | null
}

interface ProjectColumnsOptions {
	onDeleteItem?: (row: ProjectRow) => void
	isActionsDisabled?: boolean
}

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
						{date
							? new Date(date).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})
							: 'Never'}
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

/**
 * Scene table columns
 */
export interface SceneRow {
	id: string
	name: string
	description?: string
	projectId: string
	projectName: string
	/** Where the scene sits in its project. Null is the project root. */
	folderId?: string | null
	status: string
	thumbnailUrl?: string
	updatedAt: Date
}

interface SceneColumnsOptions {
	onMoveItem?: (row: SceneRow) => void
	onDeleteItem?: (row: SceneRow) => void
	isActionsDisabled?: boolean
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

/**
 * A factory rather than a module constant so the recent-scenes table can offer
 * the same row actions as every other table. It used to be navigation-only, so
 * `/dashboard` was the one place where deleting a scene meant selecting it
 * first.
 */
export function createSceneColumns(
	options: SceneColumnsOptions = {}
): ColumnDef<SceneRow>[] {
	return [
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
					className="group flex items-center gap-2.5 font-medium"
				>
					{/*
				  `SceneRow` has carried `thumbnailUrl` all along and no column ever
				  rendered it, so every scene looked the same in the list.
				*/}
					<SceneThumbnail src={row.original.thumbnailUrl} size="sm" />
					<span className="group-hover:underline">{row.getValue('name')}</span>
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
				<SceneActionsCell
					row={row.original}
					onMoveItem={options.onMoveItem}
					onDeleteItem={options.onDeleteItem}
					isActionsDisabled={options.isActionsDisabled}
				/>
			)
		}
	]
}

const SceneActionsCell = memo(function SceneActionsCell({
	row,
	onMoveItem,
	onDeleteItem,
	isActionsDisabled
}: {
	row: SceneRow
} & SceneColumnsOptions) {
	const isClientMounted = useIsClientMounted()

	const trigger = (
		<Button
			variant="ghost"
			size="sm"
			aria-label="Scene actions"
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
								to={`/preview/${row.projectId}/${row.id}`}
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
						{onMoveItem ? (
							<DropdownMenuItem
								disabled={isActionsDisabled}
								onClick={() => onMoveItem(row)}
							>
								<FolderInput className="mr-2 h-4 w-4" />
								Move to...
							</DropdownMenuItem>
						) : null}
						{onDeleteItem ? (
							<DropdownMenuItem
								disabled={isActionsDisabled}
								onClick={() => onDeleteItem(row)}
								className={DESTRUCTIVE_MENU_ITEM}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						) : null}
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
	onMoveItem?: (row: ContentRow) => void
	onDeleteItem?: (row: ContentRow) => void
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
								Only organization owners can delete a project.
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
 * Destructive dropdown item styling.
 *
 * Previously `text-destructive-foreground` (near-white) on a transparent
 * background, which is unreadable in light mode. `text-destructive` is the
 * token meant for destructive text; the tint only appears on focus.
 */
export const DESTRUCTIVE_MENU_ITEM =
	'text-destructive focus:bg-destructive/10 focus:text-destructive'

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

interface ApiKeyActionsCellProps {
	row: ApiKeyRow
	onEdit: (keyId: string) => void
	onRevoke: (keyId: string) => void
	onRotate: (keyId: string) => void
}

const ApiKeyActionsCell = memo(function ApiKeyActionsCell({
	row,
	onEdit,
	onRevoke,
	onRotate
}: ApiKeyActionsCellProps) {
	const isClientMounted = useIsClientMounted()
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
						{/*
						  Rotate is offered only on a live key. `rotateApiKey` refuses any
						  other state anyway, so enabling it here would just surface a
						  server error where a disabled item explains itself.
						*/}
						<DropdownMenuItem
							disabled={
								resolveApiKeyState(toLifecycleRow(row), new Date()) !== 'active'
							}
							onClick={() => onRotate(row.id)}
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							Rotate
						</DropdownMenuItem>
						{/*
						  Only an already-revoked key hides the action. An expired key
						  keeps it on purpose: revoking one is how an owner records that
						  it is dead deliberately rather than by lapsing, and it is the
						  step before deleting it.
						*/}
						<DropdownMenuItem
							disabled={
								resolveApiKeyState(toLifecycleRow(row), new Date()) ===
								'revoked'
							}
							onClick={() => onRevoke(row.id)}
							className={DESTRUCTIVE_MENU_ITEM}
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
					onMoveItem={options.onMoveItem}
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
	rotatedAt: Date | null
}

interface ApiKeyColumnsOptions {
	onEdit: (keyId: string) => void
	onRevoke: (keyId: string) => void
	onRotate: (keyId: string) => void
}

/**
 * Whether a rotated key has authenticated anything since it was rotated.
 *
 * This is the question that follows every rotation, and the answer is the only
 * way to tell from the dashboard that an embed somewhere is still carrying the
 * old key and being refused right now.
 */
function isUnusedSinceRotation(row: ApiKeyRow): boolean {
	if (!row.rotatedAt) return false
	if (!row.lastUsedAt) return true

	return new Date(row.lastUsedAt) <= new Date(row.rotatedAt)
}

/**
 * A table row in the shape `api-key-lifecycle` reads.
 *
 * The dates are re-wrapped rather than passed through: loader data reaches this
 * file after serialization, and `formatRelativeTime` below has always guarded
 * the same way.
 */
function toLifecycleRow(row: ApiKeyRow): ApiKeyLifecycleRow {
	return {
		active: row.active,
		expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
		revokedAt: row.revokedAt ? new Date(row.revokedAt) : null
	}
}

/**
 * How each lifecycle state is presented. A total `Record`, so a new state is a
 * compile error here rather than a row that silently renders as Inactive.
 */
const API_KEY_STATUS_PRESENTATION: Record<
	ApiKeyState,
	{
		label: string
		variant: 'default' | 'secondary' | 'destructive' | 'outline'
		Icon: typeof XCircle
	}
> = {
	revoked: { label: 'Revoked', variant: 'destructive', Icon: XCircle },
	expired: { label: 'Expired', variant: 'outline', Icon: Clock },
	active: { label: 'Active', variant: 'default', Icon: CheckCircle2 },
	inactive: { label: 'Inactive', variant: 'secondary', Icon: Ban }
}

function getApiKeyStatus(row: ApiKeyRow) {
	return API_KEY_STATUS_PRESENTATION[
		resolveApiKeyState(toLifecycleRow(row), new Date())
	]
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
				<div className="flex flex-col">
					<span className="text-muted-foreground text-sm">
						{formatRelativeTime(row.original.lastUsedAt)}
					</span>
					{isUnusedSinceRotation(row.original) && (
						<span className="text-warning text-xs">
							Unused since rotating {formatRelativeTime(row.original.rotatedAt)}
						</span>
					)}
				</div>
			)
		},
		{
			id: 'status',
			header: ({ column }) => (
				<SortableHeader column={column}>Status</SortableHeader>
			),
			accessorFn: (row) => getApiKeyStatus(row).label,
			cell: ({ row }) => {
				const { label, variant, Icon } = getApiKeyStatus(row.original)

				return (
					<Badge variant={variant} className="gap-1">
						<Icon className="size-3" />
						{label}
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
					onRotate={options.onRotate}
				/>
			)
		}
	]
}
