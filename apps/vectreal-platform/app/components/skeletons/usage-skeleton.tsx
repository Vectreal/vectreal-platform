import { Skeleton } from '@shared/components/ui/skeleton'

import { UsageMeterList, UsageMeterRowSkeleton } from '../dashboard/usage-meter'

/**
 * Skeleton loader for the usage page.
 *
 * This route has the heaviest loader in the dashboard - seven queries in
 * parallel, four of them storage aggregates joining assets through scene
 * settings - and was the only significant dashboard route with no loading
 * state at all.
 *
 * The readings come from `UsageMeterList` and `UsageMeterRowSkeleton`, the same
 * wrapper and the same row DOM the page uses. That is the point:
 * `billing-skeleton.tsx` records two rounds of a skeleton describing a layout
 * in words and going stale, because nothing fails when a panel changes shape
 * and its copy does not. A skeleton that renders the real components cannot
 * disagree with them - the columns change once and both follow.
 *
 * The breakdown below stays structural. Its content is four different lists
 * behind a tab strip, so there is no single shape to mirror; a card, a heading,
 * the strip, and some rows is true whichever tab opens first.
 */
export function UsageSkeleton() {
	return (
		<div className="space-y-4 py-6" role="status" aria-label="Loading usage">
			<section className="ds-raised space-y-4 rounded-2xl p-5">
				<Skeleton className="h-7 w-64" />
				<UsageMeterList>
					{Array.from({ length: 5 }, (_, index) => (
						<UsageMeterRowSkeleton key={index} delayMs={index * 60} />
					))}
				</UsageMeterList>
			</section>

			<section className="ds-raised space-y-3 rounded-2xl p-5">
				<Skeleton className="h-5 w-44" />
				<Skeleton className="h-8 w-56 rounded-lg" />
				<div className="space-y-3">
					{Array.from({ length: 5 }, (_, index) => (
						<Skeleton
							key={index}
							className="h-8 w-full"
							style={{ animationDelay: `${index * 60}ms` }}
						/>
					))}
				</div>
			</section>
		</div>
	)
}
