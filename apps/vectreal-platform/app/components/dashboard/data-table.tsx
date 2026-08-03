/**
 * Data Table Component with TanStack Table
 * Used for displaying projects and scenes with filtering, sorting, and batch operations
 */

import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Input } from '@shared/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@shared/components/ui/table'
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowSelectionState,
	type SortingState,
	type Updater,
	useReactTable
} from '@tanstack/react-table'
import {
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	FolderInput,
	Search,
	TextCursor,
	Trash2
} from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	searchKey?: string
	searchPlaceholder?: string
	searchValue: string
	onSearchValueChange: (value: string) => void
	sorting: SortingState
	onSortingChange: (updater: Updater<SortingState>) => void
	pagination: PaginationState
	onPaginationChange: (updater: Updater<PaginationState>) => void
	rowSelection: RowSelectionState
	onRowSelectionChange: (updater: Updater<RowSelectionState>) => void
	onDelete?: (selectedRows: TData[]) => void
	onRename?: (row: TData) => void
	onMove?: (selectedRows: TData[]) => void
	onSelectionChange?: (selectedRows: TData[]) => void
	getRowCanSelect?: (row: TData) => boolean
	isUpdating?: boolean
	updatingLabel?: string
	disableSelectionActions?: boolean
}

export function DataTable<TData, TValue>({
	columns,
	data,
	searchKey,
	searchPlaceholder = 'Search...',
	searchValue,
	onSearchValueChange,
	sorting,
	onSortingChange,
	pagination,
	onPaginationChange,
	rowSelection,
	onRowSelectionChange,
	onDelete,
	onRename,
	onMove,
	onSelectionChange,
	getRowCanSelect,
	isUpdating = false,
	updatingLabel = 'Updating content...',
	disableSelectionActions = false
}: DataTableProps<TData, TValue>) {
	const columnFilters = useMemo(
		() => (searchKey ? [{ id: searchKey, value: searchValue }] : []),
		[searchKey, searchValue]
	)

	const table = useReactTable({
		data,
		columns,
		getRowId: (row, index) => {
			const candidate = (row as { id?: unknown }).id
			return typeof candidate === 'string' ? candidate : String(index)
		},
		enableRowSelection: getRowCanSelect
			? (tableRow) => getRowCanSelect(tableRow.original)
			: true,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: onSortingChange,
		onPaginationChange: onPaginationChange,
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: onRowSelectionChange,
		state: {
			sorting,
			columnFilters,
			rowSelection,
			pagination
		}
	})

	const selectedRows = table
		.getFilteredSelectedRowModel()
		.rows.map((row) => row.original)
	const hasSelection = selectedRows.length > 0

	const getCellTitle = (value: unknown): string | undefined => {
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			return String(value)
		}

		return undefined
	}

	useEffect(() => {
		if (!onSelectionChange) {
			return
		}

		onSelectionChange(
			table.getFilteredSelectedRowModel().rows.map((row) => row.original)
		)
	}, [onSelectionChange, rowSelection, table])

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				{searchKey && (
					<div className="relative max-w-sm flex-1">
						<Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
						<Input
							placeholder={searchPlaceholder}
							value={searchValue}
							onChange={(event) => onSearchValueChange(event.target.value)}
							className="ds-sunken h-10 rounded-xl border-0 pl-9 shadow-none focus-visible:ring-2"
						/>
					</div>
				)}

				{isUpdating && (
					<div className="text-muted-foreground flex items-center gap-2 text-sm">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						<span>{updatingLabel}</span>
					</div>
				)}

				{hasSelection && (onDelete || onRename || onMove) && (
					<div className="ml-auto flex items-center gap-2">
						<span className="text-muted-foreground text-sm">
							{selectedRows.length} selected
						</span>
						{/*
						  Rename appears only when a caller handles it. It used to render
						  whenever `onDelete` was passed, so the projects page - which
						  passes only `onDelete` - offered a Rename button that did
						  nothing at all when clicked.
						*/}
						{/*
						  None of these clear the selection on click. They used to, before
						  the dialog they open had been answered - so cancelling a bulk
						  delete lost everything you had picked. The routes clear it when
						  the mutation actually succeeds.
						*/}
						{onRename ? (
							<Button
								disabled={disableSelectionActions || selectedRows.length !== 1}
								variant="outline"
								size="sm"
								onClick={() => onRename(selectedRows.at(0)!)}
							>
								<TextCursor className="mr-2 h-4 w-4" />
								Rename
							</Button>
						) : null}
						{onMove ? (
							<Button
								disabled={disableSelectionActions}
								variant="outline"
								size="sm"
								onClick={() => onMove(selectedRows)}
							>
								<FolderInput className="mr-2 h-4 w-4" />
								Move
							</Button>
						) : null}
						{onDelete ? (
							<Button
								variant="destructive"
								size="sm"
								disabled={disableSelectionActions}
								onClick={() => onDelete(selectedRows)}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</Button>
						) : null}
					</div>
				)}
			</div>

			{/*
			  One table treatment everywhere. The container is a raised surface
			  rather than a bordered box, and rows separate from it by value on
			  hover, so nothing here draws an outline.
			*/}
			<div className="ds-raised rounded-2xl p-2">
				<Table className="border-separate border-spacing-0">
					<TableHeader className="[&_tr]:border-0">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow
								key={headerGroup.id}
								className="border-0 hover:bg-transparent"
							>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="text-muted-foreground h-11 px-3 text-xs font-medium tracking-wide"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext()
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
									className="group border-0"
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											title={getCellTitle(cell.getValue())}
											className="group-hover:bg-foreground/6 group-data-[state=selected]:bg-foreground/8 border-0 px-3 py-3 transition-colors duration-150 first:rounded-l-xl last:rounded-r-xl [&>a,&>span]:max-w-sm [&>a,&>span]:truncate!"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow className="border-0">
								<TableCell
									colSpan={columns.length}
									className="text-muted-foreground h-24 text-center"
								>
									No results found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
				<div className="text-muted-foreground text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{' '}
					{table.getFilteredRowModel().rows.length} row(s) selected
				</div>
				<div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<div className="text-muted-foreground text-sm">
						Page {table.getState().pagination.pageIndex + 1} of{' '}
						{table.getPageCount()}
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}

/**
 * Helper function to create a sortable header
 */
export function SortableHeader({
	column,
	children
}: {
	column: {
		toggleSorting: (descending?: boolean) => void
		getIsSorted: () => false | 'asc' | 'desc'
	}
	children: ReactNode
}) {
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
			className="-ml-3"
		>
			{children}
			<ArrowUpDown className="ml-2 h-4 w-4" />
		</Button>
	)
}

/**
 * Helper function to create a checkbox column
 */
export function createCheckboxColumn<TData>(): ColumnDef<TData> {
	return {
		id: 'select',
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && 'indeterminate')
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				disabled={!row.getCanSelect()}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false
	}
}
