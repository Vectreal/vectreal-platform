import { SkeletonDataTable } from './skeleton-data-table'

/**
 * Skeleton loader for folder content. Subfolders and scenes share one data
 * table, so this is a single table rather than the two card grids it used to
 * show.
 */
export function FolderContentSkeleton() {
	return (
		<div className="p-6">
			<SkeletonDataTable rows={5} />
		</div>
	)
}
