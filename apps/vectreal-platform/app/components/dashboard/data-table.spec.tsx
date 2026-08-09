// @vitest-environment jsdom
/**
 * Coverage for the table engine itself, not the markup.
 *
 * `DataTable` moved from TanStack Table v8's `useReactTable` to v9's
 * `useLegacyTable` compatibility layer. That shim re-implements the v8 option
 * shape (`getCoreRowModel()` and friends are now inert markers) on top of a
 * rewritten core, so the things worth asserting are the ones the shim has to
 * keep working: rows render, sorting is wired, filtering narrows the set, row
 * selection reports the right originals, and pagination slices.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { createCheckboxColumn, DataTable, SortableHeader } from './data-table'

import type {
	PaginationState,
	RowSelectionState,
	SortingState,
	Updater
} from '@tanstack/react-table'

type SortableColumn = {
	toggleSorting: (descending?: boolean) => void
	getIsSorted: () => false | 'asc' | 'desc'
}

interface Row {
	id: string
	name: string
	scenes: number
}

const ROWS: Row[] = [
	{ id: 'a', name: 'Alpha', scenes: 3 },
	{ id: 'b', name: 'Bravo', scenes: 1 },
	{ id: 'c', name: 'Charlie', scenes: 2 }
]

const columns = [
	createCheckboxColumn<Row>(),
	{
		accessorKey: 'name',
		header: ({ column }: { column: SortableColumn }) => (
			<SortableHeader column={column}>Name</SortableHeader>
		)
	},
	{ accessorKey: 'scenes', header: 'Scenes' }
]

/**
 * `DataTable` is fully controlled, so the harness owns the state the table
 * only reports back through its `on*Change` callbacks.
 */
function Harness({
	data = ROWS,
	pageSize = 10,
	onSelectionChange,
	getRowCanSelect
}: {
	data?: Row[]
	pageSize?: number
	onSelectionChange?: (rows: Row[]) => void
	getRowCanSelect?: (row: Row) => boolean
} = {}) {
	const [search, setSearch] = useState('')
	const [sorting, setSorting] = useState<SortingState>([])
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize
	})

	const apply = <T,>(updater: Updater<T>, previous: T): T =>
		typeof updater === 'function'
			? (updater as (old: T) => T)(previous)
			: updater

	return (
		<DataTable<Row>
			columns={columns}
			data={data}
			searchKey="name"
			searchValue={search}
			onSearchValueChange={setSearch}
			sorting={sorting}
			onSortingChange={(u) => setSorting((prev) => apply(u, prev))}
			pagination={pagination}
			onPaginationChange={(u) => setPagination((prev) => apply(u, prev))}
			rowSelection={rowSelection}
			onRowSelectionChange={(u) => setRowSelection((prev) => apply(u, prev))}
			onSelectionChange={onSelectionChange}
			getRowCanSelect={getRowCanSelect}
		/>
	)
}

/** Body rows, excluding the header. */
function bodyRowNames() {
	const rows = screen.getAllByRole('row').slice(1)
	return rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)
}

describe('DataTable on the v9 legacy layer', () => {
	it('renders a row per record', () => {
		render(<Harness />)
		expect(bodyRowNames()).toEqual(['Alpha', 'Bravo', 'Charlie'])
	})

	it('sorts when the sortable header is activated', () => {
		render(<Harness />)

		fireEvent.click(screen.getByRole('button', { name: /name/i }))
		expect(bodyRowNames()).toEqual(['Alpha', 'Bravo', 'Charlie'])

		fireEvent.click(screen.getByRole('button', { name: /name/i }))
		expect(bodyRowNames()).toEqual(['Charlie', 'Bravo', 'Alpha'])
	})

	it('filters on the search key', () => {
		render(<Harness />)

		fireEvent.change(screen.getByPlaceholderText('Search...'), {
			target: { value: 'brav' }
		})
		expect(bodyRowNames()).toEqual(['Bravo'])
	})

	it('reports the selected originals, not row indices', () => {
		const onSelectionChange = vi.fn()
		render(<Harness onSelectionChange={onSelectionChange} />)

		const rows = screen.getAllByRole('row').slice(1)
		fireEvent.click(within(rows[1]).getByRole('checkbox'))

		expect(onSelectionChange).toHaveBeenLastCalledWith([
			{ id: 'b', name: 'Bravo', scenes: 1 }
		])
	})

	it('honors getRowCanSelect', () => {
		render(<Harness getRowCanSelect={(row) => row.id !== 'b'} />)

		const rows = screen.getAllByRole('row').slice(1)
		expect(within(rows[1]).getByRole('checkbox')).toBeDisabled()
		expect(within(rows[0]).getByRole('checkbox')).not.toBeDisabled()
	})

	it('paginates', () => {
		render(<Harness pageSize={2} />)

		expect(bodyRowNames()).toEqual(['Alpha', 'Bravo'])

		fireEvent.click(screen.getByRole('button', { name: /next/i }))
		expect(bodyRowNames()).toEqual(['Charlie'])
	})
})
