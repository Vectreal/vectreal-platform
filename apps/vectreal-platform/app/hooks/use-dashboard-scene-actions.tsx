import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import type {
	ApiResponse as PlatformApiResponse,
	ContentMutationAction,
	ContentActionResponse,
	CreateFolderActionResponse,
	SceneMutationAction
} from '../types/api'
import {
	selectedRowsAtom,
	type DashboardContentRowSelection
} from '../lib/stores/dashboard-management-store'

export interface SceneFolderOption {
	id: string
	name: string
	projectId: string
}

interface RunContentActionOptions {
	items?: DashboardContentRowSelection[]
	name?: string
	projectId?: string
	description?: string
	parentFolderId?: string | null
	skipToast?: boolean
}

type ActionResponsePayload = ContentActionResponse | CreateFolderActionResponse

interface DashboardSceneActionsContextValue {
	selectedRows: DashboardContentRowSelection[]
	setSelectedRows: (rows: DashboardContentRowSelection[]) => void
	runContentAction: (
		action: ContentMutationAction,
		options?: RunContentActionOptions
	) => void
	runSceneAction: (
		action: SceneMutationAction,
		options?: RunContentActionOptions
	) => void
	clearSelection: () => void
	actionState: 'idle' | 'submitting' | 'loading'
	actionData: ActionResponsePayload | null
	isTableBusy: boolean
	isRefetching: boolean
	pendingItemIds: string[]
}

let shouldToastForNextResponse = true
let lastHandledResultSignature: string | null = null

function isSameSelectedRows(
	prev: DashboardContentRowSelection[],
	next: DashboardContentRowSelection[]
) {
	if (prev.length !== next.length) {
		return false
	}

	return prev.every((prevItem, index) => {
		const nextItem = next[index]
		return (
			prevItem.id === nextItem.id &&
			prevItem.type === nextItem.type &&
			prevItem.projectId === nextItem.projectId &&
			prevItem.folderId === nextItem.folderId &&
			prevItem.name === nextItem.name
		)
	})
}

export function useDashboardSceneActions(): DashboardSceneActionsContextValue {
	const [selectedRows, setSelectedRowsState] = useAtom(selectedRowsAtom)
	const [pendingItemIds, setPendingItemIds] = useState<string[]>([])
	const [isWaitingForRefetch, setIsWaitingForRefetch] = useState(false)
	const didRefetchStartRef = useRef(false)
	const actionFetcher = useFetcher<PlatformApiResponse<ActionResponsePayload>>({
		key: 'dashboard-content-actions'
	})
	const revalidator = useRevalidator()
	const isFetcherBusy = actionFetcher.state !== 'idle'
	const isRefetching = revalidator.state !== 'idle'
	const isTableBusy = isFetcherBusy || isWaitingForRefetch || isRefetching

	const clearSelection = useCallback(() => {
		setSelectedRowsState([])
	}, [setSelectedRowsState])

	const setSelectedRowsSafe = useCallback(
		(rows: DashboardContentRowSelection[]) => {
			setSelectedRowsState((prev) =>
				isSameSelectedRows(prev, rows) ? prev : rows
			)
		},
		[setSelectedRowsState]
	)

	const runContentAction = useCallback(
		(action: ContentMutationAction, options: RunContentActionOptions = {}) => {
			shouldToastForNextResponse = !options.skipToast
			lastHandledResultSignature = null

			if (action === 'create-folder') {
				const projectId = options.projectId?.trim() || ''
				const folderName = options.name?.trim() || ''
				const folderDescription = options.description?.trim() || ''

				if (!projectId) {
					if (!options.skipToast) {
						toast.error('Project context is required to create folder')
					}
					return
				}

				if (!folderName) {
					if (!options.skipToast) {
						toast.error('Folder name is required')
					}
					return
				}

				const formData = new FormData()
				formData.append('action', action)
				formData.append('projectId', projectId)
				formData.append('name', folderName)
				if (folderDescription) {
					formData.append('description', folderDescription)
				}
				if (options.parentFolderId?.trim()) {
					formData.append('parentFolderId', options.parentFolderId.trim())
				}

				actionFetcher.submit(formData, {
					method: 'post',
					action: '/api/scenes/bulk'
				})
				setPendingItemIds([])
				return
			}

			const items = (options.items ?? selectedRows).map((row) => ({
				type: row.type,
				id: row.id
			}))

			if (items.length === 0) {
				if (!options.skipToast) {
					toast.error('Select at least one item first')
				}
				return
			}

			if (action === 'rename' && !options.name?.trim()) {
				if (!options.skipToast) {
					toast.error('Name is required for rename')
				}
				return
			}

			const formData = new FormData()
			formData.append('action', action)
			formData.append('items', JSON.stringify(items))
			if (options.name) {
				formData.append('name', options.name.trim())
			}

			setPendingItemIds(items.map((item) => item.id))

			actionFetcher.submit(formData, {
				method: 'post',
				action: '/api/scenes/bulk'
			})
		},
		[selectedRows, actionFetcher]
	)

	const runSceneAction = useCallback(
		(action: SceneMutationAction, options: RunContentActionOptions = {}) => {
			runContentAction(action, options)
		},
		[runContentAction]
	)

	useEffect(() => {
		if (actionFetcher.state !== 'idle' || !actionFetcher.data) {
			return
		}

		const responseSignature = JSON.stringify(actionFetcher.data)
		if (lastHandledResultSignature === responseSignature) {
			return
		}
		lastHandledResultSignature = responseSignature

		const shouldToast = shouldToastForNextResponse

		if (!actionFetcher.data.success || !actionFetcher.data.data) {
			setIsWaitingForRefetch(false)
			didRefetchStartRef.current = false
			setPendingItemIds([])
			if (shouldToast) {
				toast.error(actionFetcher.data.error || 'Action failed')
			}
			return
		}

		if (actionFetcher.data.data.action === 'create-folder') {
			if (shouldToast) {
				toast.success('Folder created')
			}
			didRefetchStartRef.current = false
			setIsWaitingForRefetch(true)
			revalidator.revalidate()
			return
		}

		const { summary } = actionFetcher.data.data
		if (shouldToast) {
			if (summary.failed > 0) {
				toast.warning(
					`${summary.succeeded}/${summary.total} completed, ${summary.failed} failed`
				)
			} else {
				toast.success(`${summary.succeeded} item action(s) completed`)
			}
		}

		if (summary.succeeded > 0) {
			clearSelection()
			didRefetchStartRef.current = false
			setIsWaitingForRefetch(true)
			revalidator.revalidate()
			return
		}

		setIsWaitingForRefetch(false)
		didRefetchStartRef.current = false
		setPendingItemIds([])
	}, [actionFetcher.state, actionFetcher.data, clearSelection, revalidator])

	useEffect(() => {
		if (!isWaitingForRefetch) {
			return
		}

		if (isRefetching) {
			didRefetchStartRef.current = true
			return
		}

		if (!didRefetchStartRef.current) {
			return
		}

		setIsWaitingForRefetch(false)
		setPendingItemIds([])
		didRefetchStartRef.current = false
	}, [isWaitingForRefetch, isRefetching])

	const value = useMemo(
		() => ({
			selectedRows,
			setSelectedRows: setSelectedRowsSafe,
			runContentAction,
			runSceneAction,
			clearSelection,
			actionState: actionFetcher.state,
			actionData: actionFetcher.data?.data ?? null,
			isTableBusy,
			isRefetching: isWaitingForRefetch || isRefetching,
			pendingItemIds
		}),
		[
			selectedRows,
			setSelectedRowsSafe,
			runContentAction,
			runSceneAction,
			clearSelection,
			actionFetcher.state,
			actionFetcher.data,
			isTableBusy,
			isWaitingForRefetch,
			isRefetching,
			pendingItemIds
		]
	)

	return value
}
