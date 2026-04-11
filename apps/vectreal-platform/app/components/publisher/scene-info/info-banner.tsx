import { Skeleton } from '@shared/components/ui/skeleton'
import { cn, formatFileSize } from '@shared/utils'
import { Sparkles } from 'lucide-react'

interface InfoBannerProps {
	sceneBytes?: number | null
	isLoading?: boolean
	statusText?: string | null
	onOpenOptimization?: () => void
}

const InfoBanner = ({
	sceneBytes,
	isLoading = false,
	statusText = null,
	onOpenOptimization
}: InfoBannerProps) => {
	const canOpenOptimization = typeof onOpenOptimization === 'function'

	return (
		<div className="bg-muted text-primary/80 fixed bottom-0 z-20 flex w-full items-center gap-4 px-4 py-1 text-xs font-medium">
			<button
				type="button"
				onClick={onOpenOptimization}
				disabled={!canOpenOptimization}
				className={cn(
					'flex items-center gap-2 rounded-md px-2 py-1 transition-colors',
					canOpenOptimization
						? 'hover:bg-background/60 focus-visible:ring-primary/50 cursor-pointer focus-visible:ring-2 focus-visible:outline-none'
						: 'cursor-default'
				)}
			>
				<span className="font-light">Scene Size:</span>
				<span className="inline-flex items-center gap-1.5">
					{isLoading ? (
						<Skeleton className="mt-0.5 h-3 w-20 rounded-sm" />
					) : typeof sceneBytes === 'number' ? (
						formatFileSize(sceneBytes)
					) : (
						'—'
					)}
					{canOpenOptimization && <Sparkles className="h-3.5 w-3.5 opacity-70" />}
				</span>
			</button>
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
