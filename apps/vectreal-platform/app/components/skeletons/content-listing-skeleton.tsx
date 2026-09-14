import { SkeletonDataTable } from './skeleton-data-table'

/**
 * Stands in for `ContentListing`, on a project page and on a folder page alike.
 *
 * This was two components. They were byte-identical apart from drawing six
 * placeholder rows against five, a difference that described nothing: both
 * pages list whatever the container holds, through one table, at a default page
 * size of ten. Two files for one layout is how a skeleton drifts from the page
 * it stands in for, and the page they stand in for is now one component.
 */
export function ContentListingSkeleton() {
	return (
		<div className="py-6">
			<SkeletonDataTable rows={6} />
		</div>
	)
}
