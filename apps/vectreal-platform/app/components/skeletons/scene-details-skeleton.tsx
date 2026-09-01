import { Skeleton } from '@shared/components'

/**
 * Skeleton loader for the scene detail route.
 *
 * Matches that route's own measurements — the `w-detail-panel` facts column
 * rather than a `1fr` one, and `gap-4`/`px-5` rather than `gap-6`/`px-6` — so
 * the panels do not shift once the scene loads. The `animate-pulse!` overrides
 * it used to carry are gone: `Skeleton` pulses on its own now.
 *
 * It takes its height rules from the route for the same reason: below `xl` the
 * page is one stacked column that the shell scrolls, and only from `xl` up does
 * this fill the shell's row and let each column own its overflow.
 */
export const SceneDetailsSkeleton = () => {
	return (
		<div
			className="px-5 pt-1 pb-5 xl:h-full xl:overflow-hidden xl:px-6"
			role="status"
			aria-label="Loading scene"
		>
			<div className="grid grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_auto]">
				{/* A `div` for the reason `scene.tsx` records: `SidebarInset` owns
				    this page's only `main` landmark. */}
				<div className="flex flex-col gap-4 xl:min-h-0">
					<Skeleton className="h-[55svh] min-h-64 shrink-0 rounded-2xl xl:h-auto xl:min-h-0 xl:flex-1" />

					<div className="ds-raised space-y-4 rounded-2xl px-4 py-4 sm:px-5">
						<div className="space-y-2">
							<Skeleton className="h-7 w-64" />
							<Skeleton className="h-4 w-40" />
						</div>
						{/*
						  Two actions on their own row, which is the shape the header
						  settled on: Preview and Open in Publisher. Delete is not among
						  them - it sits at the foot of the facts column - and Publish &
						  Embed is a door in that column rather than a button here.
						*/}
						<div className="flex flex-col gap-2 sm:flex-row">
							<Skeleton className="h-9 w-32 rounded-lg max-sm:w-full" />
							<Skeleton className="h-9 w-44 rounded-lg max-sm:w-full" />
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<Skeleton className="h-5 w-24 rounded-full" />
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-56" />
						</div>
					</div>
				</div>

				{/*
				  The `xl` column only, mirroring `SceneFactsPanel`. Below `xl` the
				  route renders a summary bar instead - two tiles and two doors - and
				  that is what the second block here stands in for.
				*/}
				<aside
					aria-label="Scene details"
					className="ds-raised hidden min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-5 xl:flex"
				>
					{/* One rung: the `Scene Metrics` heading. */}
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
					  Six rows, because the list is collapsed at six. Four placeholders
					  under-measured the panel by two rows and the column jumped when the
					  data landed.
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
					{/* The Publish & Embed door, and the delete beneath it. */}
					<Skeleton className="mt-auto h-14 rounded-xl" />
					<Skeleton className="h-8 rounded-lg" />
				</aside>

				<aside
					aria-label="Scene summary"
					className="ds-raised flex flex-col gap-3 rounded-2xl p-5 xl:hidden"
				>
					<div className="grid grid-cols-2 gap-2">
						<Skeleton className="h-16 rounded-xl" />
						<Skeleton
							className="h-16 rounded-xl"
							style={{ animationDelay: '70ms' }}
						/>
					</div>
					<Skeleton className="h-14 rounded-xl" />
					<Skeleton
						className="h-14 rounded-xl"
						style={{ animationDelay: '90ms' }}
					/>
					<Skeleton className="h-8 rounded-lg" />
				</aside>
			</div>
		</div>
	)
}
