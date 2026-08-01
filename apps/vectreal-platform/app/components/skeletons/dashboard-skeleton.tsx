import { Skeleton } from '@shared/components/ui/skeleton'

import { SkeletonDataTable } from './skeleton-data-table'

/**
 * Skeleton loader for the dashboard index.
 *
 * Mirrors `DashboardOverview` (four KPI tiles beside a promo panel) followed by
 * the recent-scenes table, rather than the card grid it used to show.
 */
export function DashboardSkeleton() {
	return (
		<div className="space-y-8 p-6" role="status" aria-label="Loading dashboard">
			<section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[2fr_minmax(400px,1fr)]">
				<div className="grid grid-rows-4 gap-3">
					{Array.from({ length: 4 }, (_, index) => (
						<div
							key={index}
							className="ds-raised flex items-end gap-3 rounded-2xl p-5 pb-4"
						>
							<Skeleton
								className="mb-1 h-7 w-8"
								style={{ animationDelay: `${index * 90}ms` }}
							/>
							<div className="flex items-baseline gap-3">
								<Skeleton
									className="h-4 w-20"
									style={{ animationDelay: `${index * 90 + 40}ms` }}
								/>
								<Skeleton
									className="h-3 w-28"
									style={{ animationDelay: `${index * 90 + 80}ms` }}
								/>
							</div>
						</div>
					))}
				</div>
				<Skeleton className="h-50 w-full rounded-2xl md:h-full" />
			</section>

			<section className="space-y-4">
				<div className="flex flex-col gap-1">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-6 w-64" />
				</div>
				<SkeletonDataTable rows={5} />
			</section>
		</div>
	)
}
