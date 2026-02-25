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
	Search,
	TextCursor,
	Trash2
} from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'

export interface DataTableSelectionAction<TData> {
	label: string
	onClick: (selectedRows: TData[]) => void
	disabled?: (selectedRows: TData[]) => boolean
}

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
	onRename?: (selectedRows: TData) => void
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
							className="pl-9"
						/>
					</div>
				)}

				{isUpdating && (
					<div className="text-muted-foreground flex items-center gap-2 text-sm">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						<span>{updatingLabel}</span>
					</div>
				)}

				{hasSelection && (onDelete || onRename) && (
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground text-sm">
							{selectedRows.length} selected
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (onRename) {
									onRename(selectedRows.at(0)!)
									onRowSelectionChange({})
								}
							}}
						>
							<TextCursor className="mr-2 h-4 w-4" />
							Rename
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={disableSelectionActions}
							onClick={() => {
								onDelete?.(selectedRows)
								onRowSelectionChange({})
							}}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</Button>
					</div>
				)}
			</div>

			<div className="bg-card/50 rounded-xl border backdrop-blur-sm">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
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
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											title={getCellTitle(cell.getValue())}
											className="[&>a,&>span]:max-w-sm [&>a,&>span]:truncate!"
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
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between">
				<div className="text-muted-foreground text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{' '}
					{table.getFilteredRowModel().rows.length} row(s) selected
				</div>
				<div className="flex items-center gap-2">
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
