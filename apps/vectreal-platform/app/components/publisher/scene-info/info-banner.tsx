import { Skeleton } from '@shared/components/ui/skeleton'
import { cn, formatFileSize } from '@shared/utils'

interface InfoBannerProps {
	sceneBytes?: number | null
	isLoading?: boolean
	statusText?: string | null
}

const InfoBanner = ({
	sceneBytes,
	isLoading = false,
	statusText = null
}: InfoBannerProps) => {
	return (
		<div className="bg-muted text-primary/80 fixed bottom-0 z-20 flex w-full items-center gap-4 px-4 py-1 text-xs font-medium">
			<div className="flex items-center gap-2">
				<span className="font-light">Scene Size: </span>
				{isLoading ? (
					<Skeleton className="mt-0.5 h-3 w-20 rounded-sm" />
				) : typeof sceneBytes === 'number' ? (
					formatFileSize(sceneBytes)
				) : (
					'—'
				)}
			</div>
			{statusText ? (
				<span
					className={cn(
						'text-muted-foreground text-[11px] font-normal whitespace-nowrap',
						isLoading && 'opacity-80'
					)}
				>
					{statusText}
				</span>
			) : null}
			{/* {latestSceneStats?. ?? '—'} */}
		</div>
	)
}

export default InfoBanner
