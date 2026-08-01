import { SkeletonDataTable } from './skeleton-data-table'

/**
 * Skeleton loader for the projects page, which renders a data table.
 */
export function ProjectsGridSkeleton() {
	return (
		<div className="p-6">
			<SkeletonDataTable rows={6} />
		</div>
	)
}
