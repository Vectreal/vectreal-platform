import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for project content (folders and scenes)
 */
export function ProjectContentSkeleton() {
	return (
		<div className="space-y-6 p-6">
			{/* Folders Section */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="bg-card rounded-lg border p-4">
						<div className="mb-3 flex items-start justify-between">
							<Skeleton className="h-5 w-5" />
							<Skeleton className="h-5 w-5" />
						</div>
						<Skeleton className="mb-2 h-5 w-3/4" />
						<Skeleton className="h-4 w-20" />
					</div>
				))}
			</div>

			{/* Scenes Section */}
			<div>
				<Skeleton className="animation-delay-225 mb-3 h-6 w-24" />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="bg-card rounded-lg border p-4">
							<div className="mb-3 flex items-start justify-between">
								<Skeleton className="h-5 w-5" />
								<Skeleton className="h-5 w-5" />
							</div>
							<Skeleton className="mb-2 h-5 w-3/4" />
							<Skeleton className="mb-3 h-4 w-full" />
							<div className="flex gap-2">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-5 w-20" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
