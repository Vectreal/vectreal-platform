import { Skeleton } from '@shared/components/ui/skeleton'

import { SkeletonDataTable } from './skeleton-data-table'

/**
 * Skeleton loader for the dashboard index.
 *
 * Mirrors `DashboardOverview`: the resume band, then the four usage meters,
 * then the recent-work table. The layout shows this after a 200ms navigation
 * delay, so a shape that disagrees with the real page reads as a jump rather
 * than as loading.
 */
export function DashboardSkeleton() {
	return (
		<div className="space-y-8 p-6" role="status" aria-label="Loading dashboard">
			<div className="space-y-4">
				{/* Resume band: thumbnail beside title, meta and actions. */}
				<section className="ds-raised rounded-2xl p-5">
					<div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center">
						<Skeleton className="aspect-video w-full rounded-xl" />
						<div className="space-y-3">
							<Skeleton
								className="h-3 w-24"
								style={{ animationDelay: '40ms' }}
							/>
							<Skeleton
								className="h-6 w-56"
								style={{ animationDelay: '80ms' }}
							/>
							<Skeleton
								className="h-4 w-40"
								style={{ animationDelay: '120ms' }}
							/>
							<div className="flex gap-2 pt-1">
								<Skeleton
									className="h-8 w-20 rounded-lg"
									style={{ animationDelay: '160ms' }}
								/>
								<Skeleton
									className="h-8 w-36 rounded-lg"
									style={{ animationDelay: '200ms' }}
								/>
								<Skeleton
									className="h-8 w-24 rounded-lg"
									style={{ animationDelay: '240ms' }}
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Account health band: four meter tiles. */}
				<section className="ds-raised space-y-4 rounded-2xl p-5">
					<Skeleton className="h-3 w-28" />
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{Array.from({ length: 4 }, (_, index) => (
							<div key={index} className="ds-sunken space-y-3 rounded-xl p-4">
								<Skeleton
									className="h-3 w-16"
									style={{ animationDelay: `${index * 90}ms` }}
								/>
								<Skeleton
									className="h-7 w-20"
									style={{ animationDelay: `${index * 90 + 40}ms` }}
								/>
								<Skeleton
									className="h-1 w-full"
									style={{ animationDelay: `${index * 90 + 80}ms` }}
								/>
							</div>
						))}
					</div>
				</section>
			</div>

			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-3 w-28" />
				</div>
				<SkeletonDataTable rows={5} />
			</section>
		</div>
	)
}
