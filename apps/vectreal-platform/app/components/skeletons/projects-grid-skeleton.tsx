import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for the projects browse page.
 *
 * Mirrors the grid, which is the default layout: a toolbar, then cards with a
 * thumbnail above their meta. It used to render a table skeleton, so every
 * navigation showed rows for 200ms and then jumped to a grid.
 */
export function ProjectsGridSkeleton() {
	return (
		<div className="space-y-4 p-6" role="status" aria-label="Loading projects">
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-10 min-w-48 flex-1 rounded-xl" />
				<Skeleton className="h-10 w-36 rounded-xl" />
				<Skeleton className="h-10 w-20 rounded-xl" />
			</div>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 6 }, (_, index) => (
					<div key={index} className="ds-raised overflow-hidden rounded-2xl">
						<Skeleton
							className="aspect-video w-full rounded-none"
							style={{ animationDelay: `${index * 70}ms` }}
						/>
						<div className="space-y-2 p-4">
							<Skeleton
								className="h-4 w-32"
								style={{ animationDelay: `${index * 70 + 30}ms` }}
							/>
							<Skeleton
								className="h-3 w-20"
								style={{ animationDelay: `${index * 70 + 60}ms` }}
							/>
							<Skeleton
								className="h-3 w-24"
								style={{ animationDelay: `${index * 70 + 90}ms` }}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
