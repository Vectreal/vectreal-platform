import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for organizations page
 */
export function OrganizationsSkeleton() {
	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="animation-delay-75 h-10 w-40" />
			</div>

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="bg-card rounded-lg border p-4">
						<Skeleton
							className="mb-2 h-4 w-20"
							style={{ animationDelay: `${i * 75}ms` }}
						/>
						<Skeleton
							className="h-8 w-12"
							style={{ animationDelay: `${i * 75 + 25}ms` }}
						/>
					</div>
				))}
			</div>

			{/* Table */}
			<div className="bg-card rounded-lg border">
				{/* Table Header */}
				<div className="border-b p-4">
					<div className="grid grid-cols-4 gap-4">
						<Skeleton className="animation-delay-150 h-5 w-24" />
						<Skeleton className="animation-delay-225 h-5 w-16" />
						<Skeleton className="animation-delay-300 h-5 w-20" />
						<Skeleton className="animation-delay-375 h-5 w-20" />
					</div>
				</div>

				{/* Table Rows */}
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="border-b p-4 last:border-b-0">
						<div className="grid grid-cols-4 gap-4">
							<Skeleton
								className="h-5 w-40"
								style={{ animationDelay: `${300 + i * 50}ms` }}
							/>
							<Skeleton
								className="h-5 w-16"
								style={{ animationDelay: `${325 + i * 50}ms` }}
							/>
							<Skeleton
								className="h-5 w-24"
								style={{ animationDelay: `${350 + i * 50}ms` }}
							/>
							<Skeleton
								className="h-5 w-32"
								style={{ animationDelay: `${375 + i * 50}ms` }}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
