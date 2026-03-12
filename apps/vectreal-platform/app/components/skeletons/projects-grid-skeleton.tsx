import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for projects grid page
 */
export function ProjectsGridSkeleton() {
	return (
		<div className="space-y-4 p-6">
			<Skeleton className="h-10 w-56" />
			{/* Projects Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<div key={i} className="bg-card rounded-3xl border p-4">
						<div className="mb-3 flex items-start justify-between">
							<Skeleton className="h-5 w-5" />
							<Skeleton className="h-5 w-5" />
						</div>
						<Skeleton className="mb-2 h-6 w-3/4" />
						<Skeleton className="mb-3 h-4 w-full" />
						<div className="flex items-center justify-between">
							<div className="flex gap-2">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-5 w-20" />
							</div>
							<Skeleton className="h-4 w-24" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
