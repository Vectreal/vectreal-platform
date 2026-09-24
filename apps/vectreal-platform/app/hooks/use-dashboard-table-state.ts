import { useCallback, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import type {
	PaginationState,
	RowSelectionState,
	SortingState,
	Updater
} from '@tanstack/react-table'

/** How a collection is laid out. Grid reads visually, table reads densely. */
export type DashboardView = 'grid' | 'table'

interface UseDashboardTableStateOptions {
	namespace: string
	defaultPageSize?: number
	defaultView?: DashboardView
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
	view: DashboardView
	setView: (value: DashboardView) => void
}

function applyUpdater<T>(updater: Updater<T>, current: T): T {
	if (typeof updater === 'function') {
		return (updater as (previousState: T) => T)(current)
	}

	return updater
}

export function useDashboardTableState({
	namespace,
	defaultPageSize = 10,
	defaultView = 'grid'
}: UseDashboardTableStateOptions): DashboardTableStateResult {
	const [searchParams, setSearchParams] = useSearchParams()

	const pageKey = `${namespace}-page`
	const pageSizeKey = `${namespace}-pageSize`
	const sortKey = `${namespace}-sort`
	const sortDirKey = `${namespace}-sortDir`
	const viewKey = `${namespace}-view`

	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

	/*
	  Search lives in state, not in the URL like the sort and the page.

	  It is free text, and whatever is in the URL is recorded everywhere the URL
	  goes: every pageview PostHog captures (the embed-token redaction knows only
	  `token=`), browser history, the next request's Referer, and each access
	  log on the way. On the API keys page the obvious thing to type is a live
	  key. The filtering is all client-side, so the URL was buying a search that
	  survives a reload, and nothing a loader reads.

	  It is kept against the path it was typed on. A folder is a new URL but the
	  same mounted table, and the URL used to clear the box on the way there.
	*/
	const { pathname } = useLocation()
	const [search, setSearch] = useState({ pathname, value: '' })
	const searchValue = search.pathname === pathname ? search.value : ''

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
			setSearch({ pathname, value })
			if (pagination.pageIndex === 0) return

			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				nextParams.set(pageKey, '1')
				return nextParams
			})
		},
		[pagination.pageIndex, pageKey, pathname, setSearchParams]
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

	/*
	  The layout choice lives in the URL with the rest of the table state rather
	  than in component state or localStorage: it survives reload and back
	  navigation with the sort and the page, and a shared link arrives showing
	  what the sender was looking at. The search is the exception, above.
	*/
	const view: DashboardView =
		searchParams.get(viewKey) === 'table'
			? 'table'
			: searchParams.get(viewKey) === 'grid'
				? 'grid'
				: defaultView

	const setView = useCallback(
		(value: DashboardView) => {
			setSearchParams(
				(prevParams) => {
					const nextParams = new URLSearchParams(prevParams)
					if (value === defaultView) {
						nextParams.delete(viewKey)
					} else {
						nextParams.set(viewKey, value)
					}
					return nextParams
				},
				// Switching layout is not a place to come back to - it would take two
				// Backs to leave the page after one toggle.
				{ replace: true }
			)
		},
		[defaultView, setSearchParams, viewKey]
	)

	return {
		searchValue,
		setSearchValue,
		sorting,
		onSortingChange,
		pagination,
		onPaginationChange,
		rowSelection,
		onRowSelectionChange,
		view,
		setView
	}
}
