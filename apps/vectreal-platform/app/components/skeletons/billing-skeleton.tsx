import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for the billing page.
 *
 * Mirrors `BillingSettingsSection`: the plan panel, then the usage panel as one
 * column of five rows. The route had no loading state at all, so a slow
 * subscription lookup left the page blank until it resolved.
 *
 * It said "two meter columns" and drew seven meters across them until this
 * change. #811 deleted three meters and the panel became a single list - for
 * the reason the section states, that five cells across two columns leave the
 * last one alone beside an empty cell - and the skeleton kept promising the old
 * shape. A skeleton is a claim about the page behind it, and this one had been
 * wrong for longer than it was right.
 *
 * `organizations-skeleton.tsx` records the same failure being fixed there,
 * which is the tell that nothing keeps these two files honest. Anyone changing
 * a panel's shape has to remember its skeleton by hand; the only real defence
 * is keeping the skeleton simple enough to be obviously right.
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
				<div className="space-y-3">
					{Array.from({ length: 5 }, (_, index) => (
						<div key={index} className="space-y-1.5">
							<Skeleton
								className="h-3 w-full"
								style={{ animationDelay: `${index * 60}ms` }}
							/>
							<Skeleton
								className="h-1 w-full"
								style={{ animationDelay: `${index * 60 + 30}ms` }}
							/>
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
