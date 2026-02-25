import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for folder content (subfolders and scenes)
 */
export function FolderContentSkeleton() {
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
					<Skeleton className="animation-delay-75 mb-2 h-8 w-48" />
					<Skeleton className="animation-delay-150 h-5 w-64" />
				</div>
				<Skeleton className="animation-delay-225 h-10 w-32" />
			</div>

			{/* Subfolders Section */}
			<div>
				<Skeleton className="animation-delay-75 mb-3 h-6 w-32" />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2].map((i) => (
						<div key={i} className="bg-card rounded-lg border p-4">
							<div className="mb-3 flex items-start justify-between">
								<Skeleton
									className="h-5 w-5"
									style={{ animationDelay: `${150 + i * 75}ms` }}
								/>
								<Skeleton
									className="h-5 w-5"
									style={{ animationDelay: `${175 + i * 75}ms` }}
								/>
							</div>
							<Skeleton
								className="mb-2 h-5 w-3/4"
								style={{ animationDelay: `${200 + i * 75}ms` }}
							/>
							<Skeleton
								className="h-4 w-20"
								style={{ animationDelay: `${225 + i * 75}ms` }}
							/>
						</div>
					))}
				</div>
			</div>

			{/* Scenes Section */}
			<div>
				<Skeleton className="animation-delay-300 mb-3 h-6 w-24" />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="bg-card rounded-lg border p-4">
							<div className="mb-3 flex items-start justify-between">
								<Skeleton
									className="h-5 w-5"
									style={{ animationDelay: `${350 + i * 50}ms` }}
								/>
								<Skeleton
									className="h-5 w-5"
									style={{ animationDelay: `${375 + i * 50}ms` }}
								/>
							</div>
							<Skeleton
								className="mb-2 h-5 w-3/4"
								style={{ animationDelay: `${400 + i * 50}ms` }}
							/>
							<Skeleton
								className="mb-3 h-4 w-full"
								style={{ animationDelay: `${425 + i * 50}ms` }}
							/>
							<div className="flex gap-2">
								<Skeleton
									className="h-5 w-16"
									style={{ animationDelay: `${450 + i * 50}ms` }}
								/>
								<Skeleton
									className="h-5 w-20"
									style={{ animationDelay: `${475 + i * 50}ms` }}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
