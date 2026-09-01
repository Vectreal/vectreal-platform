import { Skeleton } from '@shared/components'

/**
 * Skeleton loader for the scene detail route.
 *
 * Matches that route's own measurements — the `w-detail-panel` facts column
 * rather than a `1fr` one, and `gap-4`/`px-5` rather than `gap-6`/`px-6` — so
 * the panels do not shift once the scene loads. The `animate-pulse!` overrides
 * it used to carry are gone: `Skeleton` pulses on its own now.
 *
 * The facts column is drawn at every width, because that is where the route
 * puts it: below `xl` it flows under the main column rather than disappearing
 * into a drawer.
 */
export const SceneDetailsSkeleton = () => {
	return (
		<div
			className="h-full overflow-y-auto px-5 pt-1 pb-5 xl:overflow-hidden xl:px-6"
			role="status"
			aria-label="Loading scene"
		>
			<div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
				<main className="flex min-h-0 flex-col gap-4">
					<Skeleton className="h-[55svh] min-h-64 shrink-0 rounded-2xl xl:h-auto xl:flex-1" />

					<div className="ds-raised space-y-6 rounded-2xl px-4 py-4 sm:px-5">
						<div className="flex flex-col items-start gap-6 md:flex-row">
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-7 w-64" />
								<Skeleton className="h-4 w-40" />
							</div>
							{/*
							  Four stacked actions: preview, publisher, share, and the
							  overflow menu. The last of those renders only for a role that
							  may delete the scene, and this runs before loader data exists
							  so it cannot know which - a member sees three buttons and the
							  header settles ~48px shorter. Drawn for the common case
							  rather than the smaller one.
							*/}
							<div className="flex shrink-0 flex-col gap-3 max-md:w-full">
								{Array.from({ length: 4 }, (_, index) => (
									<Skeleton
										key={index}
										className="h-9 w-40 rounded-lg max-md:w-full"
										style={{ animationDelay: `${index * 60}ms` }}
									/>
								))}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<Skeleton className="h-5 w-24 rounded-full" />
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-56" />
						</div>
					</div>
				</main>

				<aside
					aria-label="Scene details"
					className="ds-raised xl:w-detail-panel flex flex-col gap-3 rounded-2xl p-5 xl:min-h-0 xl:overflow-hidden"
				>
					{/* Two rungs: the `At a Glance` eyebrow and the `Scene Metrics` h2. */}
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-5 w-32" />
					<div className="grid grid-cols-2 gap-2">
						{Array.from({ length: 4 }, (_, index) => (
							<Skeleton
								key={index}
								className="h-16 rounded-xl"
								style={{ animationDelay: `${index * 70}ms` }}
							/>
						))}
					</div>
					<Skeleton className="mt-2 h-5 w-20" />
					{/*
					  Six rows, not four. The aside used to show four assets and hand the
					  rest to a drawer; the list is collapsed at six now, so four
					  placeholders under-measure the panel by two rows and the page
					  jumped when the data landed.
					*/}
					<div className="space-y-2">
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton
								key={index}
								className="h-16 rounded-xl"
								style={{ animationDelay: `${index * 90 + 120}ms` }}
							/>
						))}
					</div>
				</aside>
			</div>
		</div>
	)
}
