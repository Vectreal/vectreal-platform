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
	Copy,
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
import { useClipboardCopy } from '../../hooks/use-clipboard-copy'
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

/**
 * Why a key's value cannot be put in front of its owner.
 *
 * Four reasons, and the loader is the only place three of them are
 * distinguishable at all: `decryptEmbedToken` returns null both for a row that
 * never stored a value and for one whose ciphertext no longer authenticates,
 * and only the server holds the row that separates them. Resolving this in the
 * cell would collapse two different instructions - "rotate to get one" and
 * "the encryption key changed" - into one shrug.
 */
export type ApiKeyValueUnavailableReason =
	'revoked' | 'never-stored' | 'undecryptable' | 'withheld'

/**
 * The key itself, or the reason it is missing.
 *
 * A union rather than `string | null` so the reason survives the trip to the
 * browser. The value is public by construction - it ships in an `iframe src` on
 * the customer's own page - so showing it to the owner who minted it is the
 * point; see `api-keys.tsx`, which resolves this field.
 */
export type ApiKeyRowValue =
	| { readable: true; value: string }
	| { readable: false; reason: ApiKeyValueUnavailableReason }

export interface ApiKeyRow {
	id: string
	name: string
	description?: string | null
	/**
	 * Last four characters. Still here, and still rendered, because it is what
	 * names a key whose value cannot be read back.
	 */
	keyPreview: string
	/** Resolved server-side; see `ApiKeyRowValue`. */
	value: ApiKeyRowValue
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

/**
 * Why the value is missing. The cause only - never what to do about it.
 *
 * Declared here rather than imported from `EMBED_COPY`. The dashboard must not
 * depend on the embed domain for its copy - `one-time-key-dialog.tsx` records
 * the same rule - and four short strings is the accepted cost of that.
 *
 * The advice is deliberately not baked in. Two of these causes are fixed by
 * rotating and two are not, but that is not a property of the cause: it is a
 * property of the key's lifecycle state, because `rotateApiKey` refuses
 * anything that is not active. An expired key with no stored value has a
 * recoverable *cause* and no way to act on it, and telling its owner to rotate
 * points at a menu item that is disabled and a server call that throws. See
 * `rotateAdvice` below.
 *
 * `withheld` names no mechanism for the same reason: it is reached both from a
 * role the permission table refuses and from an organization without the
 * entitlement, so naming either one would be wrong half the time.
 */
const VALUE_UNAVAILABLE_COPY: Record<ApiKeyValueUnavailableReason, string> = {
	revoked: 'the value was cleared when this key was revoked',
	'never-stored': 'no value was stored for this key',
	undecryptable: 'the stored value is no longer readable',
	withheld: 'the value is not available for this organization'
}

/**
 * The recoverable causes - the ones a fresh secret would fix.
 *
 * `revoked` is not among them: rotation refuses a revoked key, and its owner
 * replaces it rather than recovering it. `withheld` is not either, because
 * nothing about that row is broken.
 */
const ROTATABLE_REASONS: ReadonlySet<ApiKeyValueUnavailableReason> = new Set([
	'never-stored',
	'undecryptable'
])

/**
 * Whether to tell this row's owner that rotating would give them a value.
 *
 * Both halves are required. The cause has to be one rotation fixes, *and* the
 * key has to still be rotatable - `rotateApiKey` throws for any state but
 * `active`, and the Rotate menu item on this same row is disabled by exactly
 * this predicate.
 */
function rotateAdvice(row: ApiKeyRow, reason: ApiKeyValueUnavailableReason) {
	if (!ROTATABLE_REASONS.has(reason)) return null

	return resolveApiKeyState(toLifecycleRow(row), new Date()) === 'active'
		? 'rotate it to get a value you can copy'
		: null
}

const KEY_COPY_MESSAGES = {
	success: 'API key copied to clipboard',
	failure: 'Failed to copy the API key.',
	unavailable: 'Clipboard is not available in this browser.'
}

/**
 * The name cell: what the key is called, and the key itself.
 *
 * A component rather than an inline `cell` render, because it calls
 * `useClipboardCopy` and `createApiKeyColumns` is a plain function.
 *
 * The value lives here rather than in a column of its own on purpose.
 * `DataTable` puts `title={getCellTitle(cell.getValue())}` on every cell, so a
 * string accessor would publish the key into a `title` attribute - a native
 * tooltip, and something PostHog autocapture serializes into `$elements`.
 * Inside this cell the accessor stays `name` and the value is never a cell
 * value at all.
 */
export function ApiKeyNameCell({ row }: { row: ApiKeyRow }) {
	const { copy, copiedId } = useClipboardCopy()
	/*
	  Compared against the row id even though each cell owns its own hook
	  instance, which makes the comparison currently redundant - no test can
	  distinguish it from `copiedId !== null`, and none pretends to.

	  It is here because the redundancy is the fragile part, not the comparison:
	  `useClipboardCopy` carries a single `copiedId` precisely so one hook can
	  serve many affordances, and the day someone lifts it to the table to stop
	  paying for a hook per row, a boolean would light up every row at once.
	*/
	const copied = copiedId === row.id
	/*
	  Bound to a const so the narrowing survives into the copy handler. Narrowing
	  a property access does not reach inside a closure - TypeScript cannot know
	  the object was not reassigned - so `row.value.value` fails to compile there
	  while reading fine in the JSX two lines above.
	*/
	const keyValue = row.value
	const advice = keyValue.readable ? null : rotateAdvice(row, keyValue.reason)

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<span className="font-medium">{row.name}</span>
			{keyValue.readable ? (
				/*
				  `ph-no-capture` on the wrapper, not on the code alone, and it is a
				  guard rather than a nicety: `entry.client.tsx` returns `$snapshot`
				  events from `before_send` unmodified, so session replay applies no
				  redaction of its own and this class is the only thing keeping a live
				  key out of a recording. On the wrapper it also drops the copy click
				  from autocapture, which would otherwise ship the element chain.

				  Named, because otherwise a screen reader moving through this cell
				  reads the key's name and then 38 unannounced characters. The dialog
				  labels its copy of this value; the row had nothing.
				*/
				<div
					className="ph-no-capture flex max-w-[22rem] items-start gap-1.5"
					role="group"
					aria-label={`API key ${row.name}`}
				>
					{/*
					  `break-all`, not `truncate` or `whitespace-nowrap`. 38 characters of
					  mono at `text-xs` is ~270px, and a nowrap floor on a seven-column
					  table pushes the whole thing into horizontal scroll on a laptop.
					  Wrapping is what `one-time-key-dialog` and `embed-snippet-card`
					  already do with this same value.
					*/}
					{/*
					  `text-foreground`, not `text-muted-foreground`. Muted on `bg-muted`
					  measures 4.34:1 in light mode - under the 4.5:1 AA floor for text
					  this size. It was tolerable while these classes dressed a
					  four-character decoration; this is now the payload the feature
					  exists to deliver.

					  `rounded-sm` because bare `rounded` is not on this repo's scale at
					  all: Tailwind inlines its own 0.25rem default rather than reading
					  `--radius`, so it renders 4px beside a 16px button and a 20px cell
					  corner. `rounded-sm` is the 10px step.

					  `flex-1 min-w-0`, and the cap on the wrapper rather than on this
					  element. A `max-width` here bounded the box and nothing else: the
					  cell sits in an auto-layout table, so it sizes to this item's
					  max-content, the flex item keeps claiming that width, and the text
					  runs straight out of its own 24ch box and under the copy button.

					  `flex-1` sets the basis to zero so the item stops asking for
					  max-content, `min-w-0` lets it shrink past min-content, and only
					  then does `break-all` have a narrower line box to wrap into.
					*/}
					<code className="text-foreground bg-muted min-w-0 flex-1 rounded-sm px-1.5 py-0.5 font-mono text-xs break-all">
						{keyValue.value}
					</code>
					{/*
					  The label carries the copied state, because the icon is the only
					  other thing reporting it and an icon is not announced.
					*/}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-6 shrink-0"
						/*
						  Named by preview as well as name, because `api_keys.name` has
						  no unique constraint: two keys called "Production" would
						  otherwise give two buttons with one name.
						*/
						aria-label={
							copied
								? `API key ${row.name} ...${row.keyPreview} copied`
								: `Copy API key ${row.name} ...${row.keyPreview}`
						}
						onClick={() => void copy(row.id, keyValue.value, KEY_COPY_MESSAGES)}
					>
						{/*
						  Unsized: `buttonVariants` carries `[&_svg]:size-4`, which is a
						  descendant selector and outranks a `size-*` on the icon itself,
						  so an authored `size-3` here renders at 16px anyway.
						*/}
						{copied ? <CheckCircle2 /> : <Copy />}
					</Button>
				</div>
			) : (
				<div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
					<code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono">
						...{row.keyPreview}
					</code>
					<span>
						{VALUE_UNAVAILABLE_COPY[keyValue.reason]}
						{advice ? ` - ${advice}` : ''}
					</span>
				</div>
			)}
			{row.description && (
				<span className="text-muted-foreground text-sm">{row.description}</span>
			)}
		</div>
	)
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
			cell: ({ row }) => <ApiKeyNameCell row={row.original} />,
			/*
			  Also match the key preview, not only the name.

			  The workflow this serves is a support one: an embed is failing, and
			  its owner has the key from the page source in front of them. Against a
			  name-only filter, searching for any part of that key returns nothing.

			  The last four characters and not the whole value, deliberately - but
			  be clear about what that does and does not buy.

			  The search box writes through to the URL: `use-dashboard-table-state`
			  puts the raw typed string in a `?<namespace>-q=` param before any
			  filter runs, so a pasted key reaches `$current_url`, history and the
			  access logs whatever this function matches on. `redact-embed-token.ts`
			  rewrites `token=` parameters and would not touch that one. Matching
			  here cannot prevent it, and the leak has to be fixed where the value
			  reaches the URL.

			  What this does buy is not *rewarding* the paste: the last four
			  characters are what the placeholder asks for, they identify the row,
			  and they are not a credential.
			*/
			filterFn: (row, _columnId, filterValue) => {
				const needle = String(filterValue).trim().toLowerCase()
				if (!needle) return true

				const key = row.original

				return (
					key.name.toLowerCase().includes(needle) ||
					key.keyPreview.toLowerCase().includes(needle)
				)
			}
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
