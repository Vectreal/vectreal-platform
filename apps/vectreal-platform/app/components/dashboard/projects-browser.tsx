import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@shared/components/ui/toggle-group'
import { LayoutGrid, Rows3, Search } from 'lucide-react'
import { useMemo } from 'react'

import { DataTable } from './data-table'
import { ProjectCard } from './project-card'
import { type SceneStatusCounts } from './status-breakdown'
import { projectColumns, type ProjectRow } from './table-columns'

import type { DashboardView } from '../../hooks/use-dashboard-table-state'
import type { useDashboardTableState } from '../../hooks/use-dashboard-table-state'

/** Everything both layouts need for one project, derived once by the route. */
export interface ProjectBrowseItem {
	id: string
	name: string
	organizationId: string
	organizationName: string
	canDelete: boolean
	sceneCount: number
	counts: SceneStatusCounts
	/** Borrowed from the project's most recently updated scene that has one. */
	thumbnailUrl: null | string
	/** Null when the project has no scenes. Never a fabricated "today". */
	updatedAt: Date | null
}

/** Which scene state a project must contain to pass the filter. */
type StatusFilter = 'all' | keyof SceneStatusCounts

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: 'all', label: 'Any scenes' },
	{ value: 'published', label: 'Has published' },
	{ value: 'draft', label: 'Has drafts' },
	{ value: 'archived', label: 'Has archived' }
]

interface ProjectsBrowserProps {
	items: ProjectBrowseItem[]
	organizations: Array<{ id: string; name: string }>
	tableState: ReturnType<typeof useDashboardTableState>
	organizationFilter: string
	onOrganizationFilterChange: (value: string) => void
	statusFilter: StatusFilter
	onStatusFilterChange: (value: StatusFilter) => void
	isUpdating?: boolean
	onDelete: (rows: ProjectRow[]) => void
	onRename: (row: ProjectRow) => void
}

/*
  One control surface. Search, both filters and the layout toggle sit in a
  single toolbar above the content, and the same filtered list feeds whichever
  layout is showing - so switching views cannot change what is in front of you.

  This is why `DataTable` is given no `searchKey`: its built-in search filters
  the table only, which would silently disagree with the grid.
*/
export function ProjectsBrowser({
	items,
	organizations,
	tableState,
	organizationFilter,
	onOrganizationFilterChange,
	statusFilter,
	onStatusFilterChange,
	isUpdating,
	onDelete,
	onRename
}: ProjectsBrowserProps) {
	const query = tableState.searchValue.trim().toLowerCase()

	const filtered = useMemo(
		() =>
			items.filter((item) => {
				if (
					organizationFilter !== 'all' &&
					item.organizationId !== organizationFilter
				) {
					return false
				}

				if (statusFilter !== 'all' && item.counts[statusFilter] === 0) {
					return false
				}

				if (!query) {
					return true
				}

				return (
					item.name.toLowerCase().includes(query) ||
					item.organizationName.toLowerCase().includes(query)
				)
			}),
		[items, organizationFilter, query, statusFilter]
	)

	const rows: ProjectRow[] = useMemo(
		() =>
			filtered.map((item) => ({
				id: item.id,
				name: item.name,
				organizationName: item.organizationName,
				canDelete: item.canDelete,
				sceneCount: item.sceneCount,
				counts: item.counts,
				createdAt: item.updatedAt,
				updatedAt: item.updatedAt
			})),
		[filtered]
	)

	const hasFilters =
		query !== '' || organizationFilter !== 'all' || statusFilter !== 'all'

	const clearFilters = () => {
		tableState.setSearchValue('')
		onOrganizationFilterChange('all')
		onStatusFilterChange('all')
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-48 flex-1">
					<Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
					<Input
						placeholder="Search projects..."
						value={tableState.searchValue}
						onChange={(event) => tableState.setSearchValue(event.target.value)}
						className="ds-sunken h-10 rounded-xl border-0 pl-9 shadow-none focus-visible:ring-2"
					/>
				</div>

				{/*
				  The organization filter earns its place only for someone in more
				  than one - below that it is a control with a single answer.
				*/}
				{organizations.length > 1 ? (
					<Select
						value={organizationFilter}
						onValueChange={onOrganizationFilterChange}
					>
						<SelectTrigger
							aria-label="Filter by organization"
							className="ds-sunken h-10 rounded-xl border-0 shadow-none"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All organizations</SelectItem>
							{organizations.map((organization) => (
								<SelectItem key={organization.id} value={organization.id}>
									{organization.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}

				<Select
					value={statusFilter}
					onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}
				>
					<SelectTrigger
						aria-label="Filter by scene status"
						className="ds-sunken h-10 rounded-xl border-0 shadow-none"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STATUS_FILTERS.map((filter) => (
							<SelectItem key={filter.value} value={filter.value}>
								{filter.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<ToggleGroup
					type="single"
					value={tableState.view}
					onValueChange={(value) => {
						// Radix clears the value when the active item is pressed again.
						// There is no "no layout" state, so an empty value is ignored.
						if (value) {
							tableState.setView(value as DashboardView)
						}
					}}
					className="ds-sunken h-10 rounded-xl p-1"
				>
					<ToggleGroupItem
						value="grid"
						aria-label="Grid view"
						className="size-8 rounded-lg first:rounded-l-lg last:rounded-r-lg"
					>
						<LayoutGrid className="size-4" />
					</ToggleGroupItem>
					<ToggleGroupItem
						value="table"
						aria-label="Table view"
						className="size-8 rounded-lg first:rounded-l-lg last:rounded-r-lg"
					>
						<Rows3 className="size-4" />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{filtered.length === 0 ? (
				<div className="ds-raised rounded-2xl p-12 text-center">
					<p className="font-medium">No projects match these filters</p>
					<p className="text-muted-foreground mt-1 text-sm">
						{hasFilters
							? 'Try a different search term, or clear the filters.'
							: 'Nothing to show here.'}
					</p>
					{hasFilters ? (
						<Button variant="secondary" className="mt-4" onClick={clearFilters}>
							Clear filters
						</Button>
					) : null}
				</div>
			) : tableState.view === 'grid' ? (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{filtered.map((item) => (
						<ProjectCard
							key={item.id}
							project={{
								id: item.id,
								name: item.name,
								organizationName: item.organizationName,
								counts: item.counts,
								thumbnailUrl: item.thumbnailUrl,
								updatedAt: item.updatedAt
							}}
						/>
					))}
				</div>
			) : (
				<DataTable
					columns={projectColumns}
					data={rows}
					isUpdating={isUpdating}
					disableSelectionActions={isUpdating}
					searchValue={tableState.searchValue}
					onSearchValueChange={tableState.setSearchValue}
					sorting={tableState.sorting}
					onSortingChange={tableState.onSortingChange}
					pagination={tableState.pagination}
					onPaginationChange={tableState.onPaginationChange}
					rowSelection={tableState.rowSelection}
					onRowSelectionChange={tableState.onRowSelectionChange}
					getRowCanSelect={(row) => row.canDelete}
					onRename={onRename}
					onDelete={onDelete}
				/>
			)}
		</div>
	)
}

export type { StatusFilter }
