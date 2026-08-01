import { SkeletonDataTable } from './skeleton-data-table'

/**
 * Skeleton loader for project content. Folders and scenes share one data
 * table, so this is a single table rather than the two card grids it used to
 * show.
 */
export function ProjectContentSkeleton() {
	return (
		<div className="p-6">
			<SkeletonDataTable rows={6} />
		</div>
	)
}
