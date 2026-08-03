import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Info, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'

import { FolderPicker, type FolderPickerOption } from './folder-picker'
import { validateFolderMove } from '../../lib/domain/dashboard/folder-move'

import type { DashboardEntityRef } from '../../lib/domain/dashboard/dashboard-confirmation'
import type { SceneLocationOptionsResponse } from '../../types/api'

interface MoveItemsDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	items: DashboardEntityRef[]
	projectId: string | null
	isPending?: boolean
	errorMessage?: string | null
	onConfirm: (targetFolderId: string | null) => void
}

/**
 * Both arms are modelled so `fetcher.data?.success` actually narrows. Typed as
 * the success shape alone, the failure case reads as `data: undefined` and the
 * error goes unnoticed.
 */
type LocationEnvelope =
	| { success: true; data: SceneLocationOptionsResponse }
	| { success: false; error?: string }

function describeItems(items: DashboardEntityRef[]): string {
	if (items.length === 1) {
		return `"${items[0].name}"`
	}

	const folders = items.filter((item) => item.type === 'folder').length
	const scenes = items.length - folders
	const parts: string[] = []
	if (folders > 0) parts.push(`${folders} folder${folders === 1 ? '' : 's'}`)
	if (scenes > 0) parts.push(`${scenes} scene${scenes === 1 ? '' : 's'}`)

	return parts.join(' and ')
}

/**
 * Picks a destination folder for one or more scenes and folders.
 *
 * Confined to a single project on purpose: a scene's assets live in the
 * project's own asset tree, so moving one across projects orphans them and
 * breaks its next save. The publisher owns that flow because it can re-upload.
 */
export function MoveItemsDialog({
	open,
	onOpenChange,
	items,
	projectId,
	isPending = false,
	errorMessage = null,
	onConfirm
}: MoveItemsDialogProps) {
	const fetcher = useFetcher<LocationEnvelope>()
	const [target, setTarget] = useState<string | null>(null)

	useEffect(() => {
		if (!open || !projectId) {
			return
		}
		fetcher.load(
			`/api/scene-location-options?projectId=${encodeURIComponent(projectId)}`
		)
		// Deliberately not depending on `fetcher`: it is a new object each render,
		// so including it would re-request in a loop.
	}, [open, projectId])

	useEffect(() => {
		if (!open) {
			setTarget(null)
		}
	}, [open])

	const folders = fetcher.data?.success ? fetcher.data.data.folders : []
	const isLoadingFolders = fetcher.state !== 'idle' && folders.length === 0
	const loadError =
		fetcher.state === 'idle' && fetcher.data && !fetcher.data.success
			? (fetcher.data.error ?? 'Could not load the folder list')
			: null

	const depthById = useMemo(
		() => new Map(folders.map((folder) => [folder.id, folder.depth])),
		[folders]
	)

	/*
	  Every destination is checked against the same rules the repository
	  enforces, so an invalid one is explained here rather than failing after the
	  request. Descendants are derived from the loaded tree, which is the whole
	  project's folders.
	*/
	const options: FolderPickerOption[] = useMemo(() => {
		const movingFolderIds = new Set(
			items.filter((item) => item.type === 'folder').map((item) => item.id)
		)

		const descendantsOf = (folderId: string): Set<string> => {
			const descendants = new Set<string>()
			const queue = [folderId]
			while (queue.length > 0) {
				const current = queue.pop()!
				for (const folder of folders) {
					if (
						folder.parentFolderId === current &&
						!descendants.has(folder.id)
					) {
						descendants.add(folder.id)
						queue.push(folder.id)
					}
				}
			}
			return descendants
		}

		const blocked = new Map<string, string>()
		for (const movingId of movingFolderIds) {
			blocked.set(movingId, 'This is the folder being moved')
			for (const descendantId of descendantsOf(movingId)) {
				blocked.set(descendantId, 'Inside the folder being moved')
			}
		}

		return folders.map((folder) => {
			const existing = blocked.get(folder.id)
			if (existing) {
				return { ...folder, disabledReason: existing }
			}

			// For a single folder move, surface the depth and same-parent rules too.
			if (items.length === 1 && items[0].type === 'folder') {
				const check = validateFolderMove({
					folderId: items[0].id,
					currentParentId: items[0].folderId ?? null,
					targetParentId: folder.id,
					descendantIds: descendantsOf(items[0].id),
					depthById
				})
				if (!check.ok) {
					return { ...folder, disabledReason: check.message }
				}
			}

			return folder
		})
	}, [depthById, folders, items])

	const label = describeItems(items)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Move {label}</DialogTitle>
					<DialogDescription>
						Choose a destination folder in this project.
					</DialogDescription>
				</DialogHeader>

				{isLoadingFolders ? (
					<div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
						<Loader2 className="size-4 animate-spin" />
						Loading folders...
					</div>
				) : loadError ? (
					<p role="alert" className="text-destructive py-2 text-sm">
						{loadError}
					</p>
				) : (
					<FolderPicker
						options={options}
						value={target}
						onChange={setTarget}
						disabled={isPending}
					/>
				)}

				<p className="text-muted-foreground flex items-start gap-2 text-sm">
					<Info className="mt-0.5 size-4 shrink-0" />
					<span>
						To move between projects, open the scene in the publisher - its
						assets have to move with it.
					</span>
				</p>

				{errorMessage ? (
					<p role="alert" className="text-destructive text-sm">
						{errorMessage}
					</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isPending}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={isPending || isLoadingFolders || Boolean(loadError)}
						onClick={() => onConfirm(target)}
					>
						{isPending ? (
							<>
								<Loader2 className="animate-spin" />
								Moving...
							</>
						) : (
							'Move here'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
