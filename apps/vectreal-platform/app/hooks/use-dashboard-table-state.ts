import type {
	PaginationState,
	RowSelectionState,
	SortingState,
	Updater
} from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
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

	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

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

	const setSearchValue = useCallback(
		(value: string) => {
			const trimmedValue = value.trim()
			const isSameSearchValue = trimmedValue
				? searchValue === value
				: searchValue === ''
			const isAlreadyOnFirstPage = pagination.pageIndex === 0

			if (isSameSearchValue && isAlreadyOnFirstPage) {
				return
			}

			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				if (trimmedValue) {
					nextParams.set(qKey, value)
				} else {
					nextParams.delete(qKey)
				}
				nextParams.set(pageKey, '1')
				return nextParams
			})
		},
		[pagination.pageIndex, pageKey, qKey, searchValue, setSearchParams]
	)

	const onSortingChange = useCallback(
		(updater: Updater<SortingState>) => {
			const nextSorting = applyUpdater(updater, sorting)
			const currentSort = sorting[0]
			const nextSort = nextSorting[0]

			const isSortingUnchanged =
				currentSort?.id === nextSort?.id && currentSort?.desc === nextSort?.desc
			const isAlreadyOnFirstPage = pagination.pageIndex === 0

			if (isSortingUnchanged && isAlreadyOnFirstPage) {
				return
			}

			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
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
		[
			pagination.pageIndex,
			pageKey,
			setSearchParams,
			sortDirKey,
			sortKey,
			sorting
		]
	)

	const onPaginationChange = useCallback(
		(updater: Updater<PaginationState>) => {
			const nextPagination = applyUpdater(updater, pagination)

			if (
				nextPagination.pageIndex === pagination.pageIndex &&
				nextPagination.pageSize === pagination.pageSize
			) {
				return
			}

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
			setRowSelection((previousSelection) =>
				applyUpdater(updater, previousSelection)
			)
		},
		[]
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
