import { Skeleton } from '@shared/components/ui/skeleton'
import { cn } from '@shared/utils'

/**
 * Stands in for `DataTable`.
 *
 * Four dashboard routes render a data table, and every one of them used to show
 * a grid of cards while loading — so the layout visibly rearranged the moment
 * data arrived. This mirrors the real thing instead: the same raised container,
 * the same row rhythm, the same search field and footer.
 */

const COLUMN_TEMPLATE = 'grid-cols-[1.25rem_minmax(0,2.5fr)_minmax(0,1fr)_6rem]'

interface SkeletonDataTableProps {
	rows?: number
	className?: string
}

export function SkeletonDataTable({
	rows = 6,
	className
}: SkeletonDataTableProps) {
	return (
		<div
			role="status"
			aria-label="Loading table"
			className={cn('space-y-4', className)}
		>
			<Skeleton className="h-10 w-full max-w-sm rounded-xl" />

			<div className="ds-raised rounded-2xl p-2">
				<div
					className={cn('grid h-11 items-center gap-4 px-3', COLUMN_TEMPLATE)}
				>
					<Skeleton className="size-4 rounded" />
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-3 w-16" />
					<Skeleton className="h-3 w-12 justify-self-end" />
				</div>

				{/*
				  The delays offset the phase of the pulse loop rather than delaying
				  an entrance, so the rows read as one travelling wave.
				*/}
				{Array.from({ length: rows }, (_, index) => (
					<div
						key={index}
						className={cn('grid items-center gap-4 px-3 py-3', COLUMN_TEMPLATE)}
					>
						<Skeleton
							className="size-4 rounded"
							style={{ animationDelay: `${index * 90}ms` }}
						/>
						<Skeleton
							className="h-4"
							style={{
								width: `${70 - ((index * 13) % 35)}%`,
								animationDelay: `${index * 90 + 30}ms`
							}}
						/>
						<Skeleton
							className="h-4 w-20"
							style={{ animationDelay: `${index * 90 + 60}ms` }}
						/>
						<Skeleton
							className="h-4 w-16 justify-self-end"
							style={{ animationDelay: `${index * 90 + 90}ms` }}
						/>
					</div>
				))}
			</div>

			<div className="flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
				<Skeleton className="h-4 w-44" />
				<div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
					<Skeleton className="h-8 w-24 rounded-lg" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-8 w-20 rounded-lg" />
				</div>
			</div>
		</div>
	)
}
