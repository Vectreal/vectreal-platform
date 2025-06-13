import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Button } from '@vctrl-ui/ui/button'
import { cn, formatFileSize } from '@vctrl-ui/utils'
import { useAtom } from 'jotai/react'
import { FileCheck2, FileWarning } from 'lucide-react'

import { processAtom } from '../../lib/stores/publisher-config-store'

export function StatusIndicator() {
	const { isSaved, isSaving } = { isSaved: false, isSaving: false } // Placeholder for context, replace with actual context if needed
	const { optimize } = useModelContext()
	const {
		optimizations: { info }
	} = optimize

	const [{ showSidebar }, setProcess] = useAtom(processAtom)

	function handleOptimizeClick() {
		setProcess((prev) => ({
			...prev,
			step: 'preparing',
			mode: 'optimize',
			showSidebar: true,
			showInfo: false
		}))
	}

	const isOptimized = Number(info.improvement.sceneBytes) > 0
	const percentageImprovement = Math.round(
		((info.initial.sceneBytes - info.optimized.sceneBytes) /
			info.initial.sceneBytes) *
			100
	)

	return (
		<div className="fixed top-0 left-1/2 z-20 m-4 flex -translate-x-1/2 items-center gap-4">
			<div className="absolute inset-0 -z-10 scale-150 bg-black/50 blur-3xl" />
			{/* <Button
				disabled={showSidebar}
				size="sm"
				variant="secondary"
				onClick={handleOptimizeClick}
				className="text-muted-foreground inline-flex items-center gap-2 rounded-xl text-sm"
			>
				{isOptimized ? (
					<>
						<FileCheck2 size={12} />
						<p>
							{' '}
							{percentageImprovement}% Size Optimization |{' '}
							{formatFileSize(info.optimized.sceneBytes)}
						</p>
					</>
				) : (
					<>
						<FileWarning size={12} />
						<p>Not optimized</p>
					</>
				)}
			</Button> */}

			<div
				className={cn(
					'flex items-center gap-1.5 text-xs font-medium transition-all duration-300',
					isSaved
						? 'text-green-300'
						: isSaving
							? 'text-orange-500'
							: 'text-yellow-500'
				)}
			>
				<div className="relative">
					<span
						className={cn(
							'inline-block h-2 w-2 rounded-full after:absolute after:top-0 after:left-0 after:h-full after:w-full after:animate-pulse after:blur-md after:content-[""]',
							isSaved
								? 'bg-green-400 after:bg-green-400'
								: isSaving
									? 'animate-pulse bg-orange-400 after:bg-orange-400'
									: 'bg-yellow-400 after:bg-yellow-500'
						)}
						aria-hidden="true"
					/>
				</div>
				{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Unsaved'}
			</div>
		</div>
	)
}
