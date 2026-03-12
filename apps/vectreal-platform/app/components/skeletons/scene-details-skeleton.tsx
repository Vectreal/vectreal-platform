import { Skeleton } from '@shared/components'

export const SceneDetailsSkeleton = () => {
	return (
		<div className="mt-12 grid h-full gap-6 p-6 md:grid-cols-[3fr_1fr]">
			<div className="grid w-full grid-rows-[5fr_2fr] gap-6">
				<Skeleton className="animate-pulse!" />
				<Skeleton className="animate-pulse!" />
			</div>

			<Skeleton className="animate-pulse!" />
		</div>
	)
}
