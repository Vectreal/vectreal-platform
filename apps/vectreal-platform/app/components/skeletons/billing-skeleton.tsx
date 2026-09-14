import { Skeleton } from '@shared/components/ui/skeleton'

/**
 * Skeleton loader for the billing page.
 *
 * Mirrors `BillingSettingsSection`: the plan panel, and the actions beside it.
 *
 * It has now been wrong twice, both times the same way. It said "two meter
 * columns" and drew seven meters until #811 deleted three and the panel became
 * one list; then it drew that list of five until #857 moved usage to its own
 * route, leaving billing with a "View usage" link and no meters at all. Each
 * time it went on promising a shape that was no longer behind it, because
 * nothing fails when a panel changes and its skeleton does not.
 *
 * So it is structural now - the panel and its controls, not a count of rows
 * inside them. The durable answer is the one `usage-skeleton.tsx` uses: render
 * the page's own components in a loading state, so the skeleton cannot disagree
 * with a layout it does not restate. Billing's remaining panel has no such
 * component to borrow yet, which is the work left here.
 */
export function BillingSkeleton() {
	return (
		<div className="space-y-4 py-6" role="status" aria-label="Loading billing">
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
		</div>
	)
}
