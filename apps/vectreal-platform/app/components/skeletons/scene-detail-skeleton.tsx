import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for scene detail page
 */
export function SceneDetailSkeleton() {
	return (
		<div className="space-y-6 p-6">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2">
				<Skeleton className="h-5 w-24" />
				<Skeleton className="animation-delay-75 h-5 w-4" />
				<Skeleton className="animation-delay-150 h-5 w-32" />
				<Skeleton className="animation-delay-225 h-5 w-4" />
				<Skeleton className="animation-delay-300 h-5 w-28" />
			</div>

			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="animation-delay-75 mb-2 h-8 w-64" />
					<Skeleton className="animation-delay-150 h-5 w-96" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="animation-delay-225 h-10 w-24" />
					<Skeleton className="animation-delay-300 h-10 w-28" />
				</div>
			</div>

			{/* Scene Viewer */}
			<div className="bg-card flex h-[500px] items-center justify-center rounded-lg border">
				<div className="text-center">
					<Skeleton className="animation-delay-150 mx-auto mb-4 h-16 w-16 rounded-full" />
					<Skeleton className="animation-delay-225 mx-auto mb-2 h-5 w-48" />
					<Skeleton className="animation-delay-300 mx-auto h-4 w-64" />
				</div>
			</div>

			{/* Scene Details */}
			<div className="grid gap-6 md:grid-cols-2">
				<div className="bg-card rounded-lg border p-4">
					<Skeleton className="animation-delay-150 mb-4 h-6 w-32" />
					<div className="space-y-3">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="flex justify-between">
								<Skeleton
									className="h-5 w-24"
									style={{ animationDelay: `${200 + i * 50}ms` }}
								/>
								<Skeleton
									className="h-5 w-32"
									style={{ animationDelay: `${225 + i * 50}ms` }}
								/>
							</div>
						))}
					</div>
				</div>

				<div className="bg-card rounded-lg border p-4">
					<Skeleton className="animation-delay-150 mb-4 h-6 w-40" />
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex justify-between">
								<Skeleton
									className="h-5 w-28"
									style={{ animationDelay: `${200 + i * 50}ms` }}
								/>
								<Skeleton
									className="h-5 w-20"
									style={{ animationDelay: `${225 + i * 50}ms` }}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
