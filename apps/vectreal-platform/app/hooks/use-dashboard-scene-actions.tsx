import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import { useFetcher, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import type {
	ApiResponse as PlatformApiResponse,
	ContentMutationAction,
	ContentActionResponse,
	CreateFolderActionResponse,
	SceneMutationAction
} from '../types/api'

export interface DashboardContentRowSelection {
	id: string
	type: 'scene' | 'folder'
	name: string
	projectId: string
	folderId?: string | null
}

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
}

interface DashboardSceneActionsProviderProps {
	children: React.ReactNode
}

const DashboardSceneActionsContext =
	createContext<DashboardSceneActionsContextValue | null>(null)

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

export function DashboardSceneActionsProvider({
	children
}: DashboardSceneActionsProviderProps) {
	const [selectedRows, setSelectedRows] = useState<
		DashboardContentRowSelection[]
	>([])
	const actionFetcher = useFetcher<PlatformApiResponse<ActionResponsePayload>>({
		key: 'dashboard-content-actions'
	})
	const revalidator = useRevalidator()
	const shouldToastRef = useRef(true)
	const lastHandledResultRef = useRef<string | null>(null)

	const clearSelection = useCallback(() => {
		setSelectedRows([])
	}, [])

	const setSelectedRowsSafe = useCallback(
		(rows: DashboardContentRowSelection[]) => {
			setSelectedRows((prev) => (isSameSelectedRows(prev, rows) ? prev : rows))
		},
		[]
	)

	const runContentAction = useCallback(
		(action: ContentMutationAction, options: RunContentActionOptions = {}) => {
			shouldToastRef.current = !options.skipToast
			lastHandledResultRef.current = null

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
		if (lastHandledResultRef.current === responseSignature) {
			return
		}
		lastHandledResultRef.current = responseSignature

		const shouldToast = shouldToastRef.current

		if (!actionFetcher.data.success || !actionFetcher.data.data) {
			if (shouldToast) {
				toast.error(actionFetcher.data.error || 'Action failed')
			}
			return
		}

		if (actionFetcher.data.data.action === 'create-folder') {
			if (shouldToast) {
				toast.success('Folder created')
			}
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
			revalidator.revalidate()
		}
	}, [actionFetcher.state, actionFetcher.data, clearSelection, revalidator])

	const value = useMemo(
		() => ({
			selectedRows,
			setSelectedRows: setSelectedRowsSafe,
			runContentAction,
			runSceneAction,
			clearSelection,
			actionState: actionFetcher.state,
			actionData: actionFetcher.data?.data ?? null
		}),
		[
			selectedRows,
			setSelectedRowsSafe,
			runContentAction,
			runSceneAction,
			clearSelection,
			actionFetcher.state,
			actionFetcher.data
		]
	)

	return (
		<DashboardSceneActionsContext.Provider value={value}>
			{children}
		</DashboardSceneActionsContext.Provider>
	)
}

export function useDashboardSceneActions() {
	const context = useContext(DashboardSceneActionsContext)
	if (!context) {
		throw new Error(
			'useDashboardSceneActions must be used within DashboardSceneActionsProvider'
		)
	}
	return context
}
