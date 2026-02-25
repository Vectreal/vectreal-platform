import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for dashboard index page
 */
export function DashboardSkeleton() {
	return (
		<div className="space-y-8 p-6">
			{/* Statistics Overview */}
			<div className="flex max-w-lg justify-between gap-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="bg-card flex-1 rounded-lg border p-4">
						<Skeleton
							className="mb-2 h-6 w-6"
							style={{ animationDelay: `${i * 75}ms` }}
						/>
						<Skeleton
							className="mb-1 h-8 w-16"
							style={{ animationDelay: `${i * 75 + 25}ms` }}
						/>
						<Skeleton
							className="h-4 w-20"
							style={{ animationDelay: `${i * 75 + 50}ms` }}
						/>
					</div>
				))}
			</div>

			{/* Recent Scenes */}
			<div>
				<div className="mb-4 flex items-center justify-between">
					<Skeleton className="animation-delay-150 h-7 w-40" />
					<Skeleton className="animation-delay-225 h-9 w-20" />
				</div>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="bg-card rounded-lg border p-4">
							<div className="mb-3 flex items-start justify-between">
								<Skeleton
									className="h-5 w-5"
									style={{ animationDelay: `${200 + i * 40}ms` }}
								/>
							</div>
							<Skeleton
								className="mb-2 h-5 w-3/4"
								style={{ animationDelay: `${225 + i * 40}ms` }}
							/>
							<Skeleton
								className="mb-3 h-4 w-full"
								style={{ animationDelay: `${250 + i * 40}ms` }}
							/>
							<div className="flex gap-2">
								<Skeleton
									className="h-5 w-16"
									style={{ animationDelay: `${275 + i * 40}ms` }}
								/>
								<Skeleton
									className="h-5 w-20"
									style={{ animationDelay: `${300 + i * 40}ms` }}
								/>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Recent Projects */}
			<div>
				<div className="mb-4 flex items-center justify-between">
					<Skeleton className="animation-delay-300 h-7 w-40" />
					<Skeleton className="animation-delay-375 h-9 w-20" />
				</div>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="bg-card rounded-lg border p-4">
							<div className="mb-3 flex items-start justify-between">
								<Skeleton
									className="h-5 w-5"
									style={{ animationDelay: `${350 + i * 40}ms` }}
								/>
							</div>
							<Skeleton
								className="mb-2 h-5 w-3/4"
								style={{ animationDelay: `${375 + i * 40}ms` }}
							/>
							<Skeleton
								className="h-4 w-full"
								style={{ animationDelay: `${400 + i * 40}ms` }}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
