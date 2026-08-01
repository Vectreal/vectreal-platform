import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for the billing page.
 *
 * Mirrors `BillingSettingsSection`: the plan panel, then the usage panel with
 * its two meter columns. The route had no loading state at all, so a slow
 * subscription lookup left the page blank until it resolved.
 */
export function BillingSkeleton() {
	return (
		<div className="space-y-4 p-6" role="status" aria-label="Loading billing">
			<section className="ds-raised rounded-2xl p-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-2">
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-4 w-44" style={{ animationDelay: '60ms' }} />
					</div>
					<div className="flex gap-2">
						<Skeleton
							className="h-8 w-32 rounded-lg"
							style={{ animationDelay: '100ms' }}
						/>
						<Skeleton
							className="h-8 w-24 rounded-lg"
							style={{ animationDelay: '140ms' }}
						/>
					</div>
				</div>
			</section>

			<section className="ds-raised space-y-5 rounded-2xl p-5">
				<Skeleton className="h-3 w-40" />
				<div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
					{[4, 3].map((meters, column) => (
						<div key={column} className="space-y-3">
							<Skeleton
								className="h-3 w-16"
								style={{ animationDelay: `${column * 120}ms` }}
							/>
							{Array.from({ length: meters }, (_, index) => (
								<div key={index} className="space-y-1.5">
									<Skeleton
										className="h-3 w-full"
										style={{
											animationDelay: `${column * 120 + index * 60}ms`
										}}
									/>
									<Skeleton
										className="h-1 w-full"
										style={{
											animationDelay: `${column * 120 + index * 60 + 30}ms`
										}}
									/>
								</div>
							))}
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
