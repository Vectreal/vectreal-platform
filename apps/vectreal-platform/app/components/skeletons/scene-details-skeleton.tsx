import { Skeleton } from '@shared/components'

/**
 * Skeleton loader for the scene detail route.
 *
 * Matches that route's own measurements — a `20rem` sidebar rather than a `1fr`
 * column, and `gap-4`/`px-5` rather than `gap-6`/`px-6` — so the panels do not
 * shift once the scene loads. The `animate-pulse!` overrides it used to carry
 * are gone: `Skeleton` pulses on its own now.
 */
export const SceneDetailsSkeleton = () => {
	return (
		<div
			className="h-full overflow-hidden px-5 pt-1 pb-5 xl:px-6"
			role="status"
			aria-label="Loading scene"
		>
			<div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<main className="flex min-h-0 flex-col gap-4">
					<Skeleton className="min-h-64 flex-1 rounded-2xl" />

					<div className="ds-raised space-y-6 rounded-2xl px-4 py-4 sm:px-5">
						<div className="flex flex-col items-start gap-6 md:flex-row">
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-7 w-64" />
								<Skeleton className="h-4 w-40" />
							</div>
							<div className="flex shrink-0 gap-2">
								<Skeleton className="h-9 w-32 rounded-lg" />
								<Skeleton className="h-9 w-36 rounded-lg" />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{Array.from({ length: 4 }, (_, index) => (
								<div key={index} className="space-y-2">
									<Skeleton
										className="h-3 w-16"
										style={{ animationDelay: `${index * 90}ms` }}
									/>
									<Skeleton
										className="h-4 w-24"
										style={{ animationDelay: `${index * 90 + 40}ms` }}
									/>
								</div>
							))}
						</div>
					</div>
				</main>

				<aside className="ds-raised hidden min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-4 xl:flex">
					<Skeleton className="h-5 w-32" />
					<div className="grid grid-cols-2 gap-2">
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton
								key={index}
								className="h-4"
								style={{ animationDelay: `${index * 70}ms` }}
							/>
						))}
					</div>
					<div className="mt-2 space-y-2">
						{Array.from({ length: 4 }, (_, index) => (
							<Skeleton
								key={index}
								className="h-12 rounded-xl"
								style={{ animationDelay: `${index * 90 + 120}ms` }}
							/>
						))}
					</div>
				</aside>
			</div>
		</div>
	)
}
