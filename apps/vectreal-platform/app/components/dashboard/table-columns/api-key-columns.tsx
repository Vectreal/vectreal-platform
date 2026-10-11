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
	CheckCircle2,
	Copy,
	Ellipsis,
	KeyRound,
	Pencil,
	RefreshCw
} from 'lucide-react'
import { memo } from 'react'

import {
	formatRelativeDeadline,
	getApiKeyStatus,
	isUnusedSinceRotation,
	rotateAdvice,
	toLifecycleRow,
	VALUE_UNAVAILABLE_COPY,
	type ApiKeyRow
} from './api-key-status'
import { DESTRUCTIVE_MENU_ITEM } from './destructive-menu-item'
import { useClipboardCopy } from '../../../hooks/use-clipboard-copy'
import { useIsClientMounted } from '../../../hooks/use-is-client-mounted'
import {
	isApiKeyExpiringSoon,
	resolveApiKeyState
} from '../../../lib/domain/auth/api-key-lifecycle'
import { SortableHeader } from '../data-table'
import { RelativeTime } from '../relative-time'

import type { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy'

interface ApiKeyColumnsOptions {
	onEdit: (keyId: string) => void
	onRevoke: (keyId: string) => void
	onRotate: (keyId: string) => void
}

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
					  cell sits in an auto-layout table, so the column sizes to this
					  item's max-content, the flex item keeps claiming that width, and
					  the value ran straight out of its own box and under the copy
					  button.

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
	/*
	  No checkbox column. This page wires no bulk action - revoke and rotate are
	  per-key and each opens its own confirmation - so a selected row had nothing
	  that could act on it.
	*/
	return [
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
						{row.original.lastUsedAt ? (
							<RelativeTime at={row.original.lastUsedAt} />
						) : (
							'Never'
						)}
					</span>
					{isUnusedSinceRotation(row.original) && (
						<span className="text-warning text-xs">
							Unused since rotating{' '}
							{row.original.rotatedAt ? (
								<RelativeTime at={row.original.rotatedAt} />
							) : (
								'never'
							)}
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
					<div className="flex flex-col items-start gap-1">
						<Badge variant={variant} className="gap-1">
							<Icon className="size-3" />
							{label}
						</Badge>
						{/*
						  A line under the badge rather than a fifth `ApiKeyState`. The
						  key is still Active - Postgres says so, and `isApiKeyLive` has
						  to keep agreeing with it - so this says how much longer rather
						  than something else about now. Same shape the Last Used column
						  uses for "Unused since rotating".
						*/}
						{isApiKeyExpiringSoon(toLifecycleRow(row.original), new Date()) && (
							<span className="text-warning text-xs">
								Expires {formatRelativeDeadline(row.original.expiresAt)}
							</span>
						)}
					</div>
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
