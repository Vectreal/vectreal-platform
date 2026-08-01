import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for the organizations page.
 *
 * Three stat cards and two card sections, matching what the route renders. It
 * previously showed four stat cards above a bordered table, neither of which
 * exists on that page.
 */
export function OrganizationsSkeleton() {
	return (
		<div
			className="space-y-6 p-6"
			role="status"
			aria-label="Loading organizations"
		>
			<div className="grid gap-4 md:grid-cols-3">
				{Array.from({ length: 3 }, (_, index) => (
					<div key={index} className="ds-raised space-y-2 rounded-xl p-6">
						<Skeleton
							className="h-4 w-32"
							style={{ animationDelay: `${index * 90}ms` }}
						/>
						<Skeleton
							className="h-6 w-12"
							style={{ animationDelay: `${index * 90 + 40}ms` }}
						/>
					</div>
				))}
			</div>

			<section className="space-y-3">
				<Skeleton className="h-5 w-48" />
				<OrganizationCardSkeleton />
			</section>

			<section className="space-y-3">
				<Skeleton className="h-5 w-40" />
				<div className="grid gap-4 lg:grid-cols-2">
					{Array.from({ length: 4 }, (_, index) => (
						<OrganizationCardSkeleton key={index} delay={index * 90} />
					))}
				</div>
			</section>
		</div>
	)
}

function OrganizationCardSkeleton({ delay = 0 }: { delay?: number }) {
	return (
		<div className="ds-raised space-y-4 rounded-xl p-6">
			<div className="flex items-start gap-3">
				<Skeleton
					className="size-9 shrink-0 rounded-lg"
					style={{ animationDelay: `${delay}ms` }}
				/>
				<div className="min-w-0 flex-1 space-y-2">
					<Skeleton
						className="h-5 w-40"
						style={{ animationDelay: `${delay + 40}ms` }}
					/>
					<Skeleton
						className="h-3 w-56"
						style={{ animationDelay: `${delay + 80}ms` }}
					/>
				</div>
			</div>
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Skeleton
						className="h-3 w-12"
						style={{ animationDelay: `${delay + 120}ms` }}
					/>
					<Skeleton
						className="h-5 w-16 rounded-full"
						style={{ animationDelay: `${delay + 140}ms` }}
					/>
				</div>
				<div className="flex items-center justify-between">
					<Skeleton
						className="h-3 w-16"
						style={{ animationDelay: `${delay + 160}ms` }}
					/>
					<Skeleton
						className="h-3 w-20"
						style={{ animationDelay: `${delay + 180}ms` }}
					/>
				</div>
			</div>
		</div>
	)
}
