import type {
	PaginationState,
	RowSelectionState,
	SortingState,
	Updater
} from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

interface UseDashboardTableStateOptions {
	namespace: string
	defaultPageSize?: number
}

interface DashboardTableStateResult {
	searchValue: string
	setSearchValue: (value: string) => void
	sorting: SortingState
	onSortingChange: (updater: Updater<SortingState>) => void
	pagination: PaginationState
	onPaginationChange: (updater: Updater<PaginationState>) => void
	rowSelection: RowSelectionState
	onRowSelectionChange: (updater: Updater<RowSelectionState>) => void
}

function applyUpdater<T>(updater: Updater<T>, current: T): T {
	if (typeof updater === 'function') {
		return (updater as (previousState: T) => T)(current)
	}

	return updater
}

export function useDashboardTableState({
	namespace,
	defaultPageSize = 10
}: UseDashboardTableStateOptions): DashboardTableStateResult {
	const [searchParams, setSearchParams] = useSearchParams()

	const qKey = `${namespace}-q`
	const pageKey = `${namespace}-page`
	const pageSizeKey = `${namespace}-pageSize`
	const sortKey = `${namespace}-sort`
	const sortDirKey = `${namespace}-sortDir`
	const selectionKey = `${namespace}-selected`

	const searchValue = searchParams.get(qKey) ?? ''

	const sorting = useMemo<SortingState>(() => {
		const sortId = searchParams.get(sortKey)
		if (!sortId) {
			return []
		}

		return [
			{
				id: sortId,
				desc: searchParams.get(sortDirKey) === 'desc'
			}
		]
	}, [searchParams, sortDirKey, sortKey])

	const pagination = useMemo<PaginationState>(() => {
		const rawPage = Number(searchParams.get(pageKey) || 1)
		const rawPageSize = Number(searchParams.get(pageSizeKey) || defaultPageSize)

		return {
			pageIndex: Number.isFinite(rawPage) && rawPage > 0 ? rawPage - 1 : 0,
			pageSize:
				Number.isFinite(rawPageSize) && rawPageSize > 0
					? rawPageSize
					: defaultPageSize
		}
	}, [defaultPageSize, pageKey, pageSizeKey, searchParams])

	const rowSelection = useMemo<RowSelectionState>(() => {
		const rawSelectedIds = searchParams.get(selectionKey)
		if (!rawSelectedIds) {
			return {}
		}

		return rawSelectedIds
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
			.reduce<RowSelectionState>((acc, id) => {
				acc[id] = true
				return acc
			}, {})
	}, [searchParams, selectionKey])

	const setSearchValue = useCallback(
		(value: string) => {
			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				if (value.trim()) {
					nextParams.set(qKey, value)
				} else {
					nextParams.delete(qKey)
				}
				nextParams.set(pageKey, '1')
				return nextParams
			})
		},
		[pageKey, qKey, setSearchParams]
	)

	const onSortingChange = useCallback(
		(updater: Updater<SortingState>) => {
			const nextSorting = applyUpdater(updater, sorting)

			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				const nextSort = nextSorting[0]

				if (!nextSort) {
					nextParams.delete(sortKey)
					nextParams.delete(sortDirKey)
				} else {
					nextParams.set(sortKey, nextSort.id)
					nextParams.set(sortDirKey, nextSort.desc ? 'desc' : 'asc')
				}

				nextParams.set(pageKey, '1')
				return nextParams
			})
		},
		[pageKey, setSearchParams, sortDirKey, sortKey, sorting]
	)

	const onPaginationChange = useCallback(
		(updater: Updater<PaginationState>) => {
			const nextPagination = applyUpdater(updater, pagination)

			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				nextParams.set(pageKey, String(nextPagination.pageIndex + 1))
				nextParams.set(pageSizeKey, String(nextPagination.pageSize))
				return nextParams
			})
		},
		[pagination, pageKey, pageSizeKey, setSearchParams]
	)

	const onRowSelectionChange = useCallback(
		(updater: Updater<RowSelectionState>) => {
			const nextSelection = applyUpdater(updater, rowSelection)

			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				const selectedIds = Object.entries(nextSelection)
					.filter(([, isSelected]) => Boolean(isSelected))
					.map(([id]) => id)

				if (selectedIds.length > 0) {
					nextParams.set(selectionKey, selectedIds.join(','))
				} else {
					nextParams.delete(selectionKey)
				}

				return nextParams
			})
		},
		[rowSelection, selectionKey, setSearchParams]
	)

	return {
		searchValue,
		setSearchValue,
		sorting,
		onSortingChange,
		pagination,
		onPaginationChange,
		rowSelection,
		onRowSelectionChange
	}
}
