import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Button } from '@vctrl-ui/ui/button'
import { cn, formatFileSize } from '@vctrl-ui/utils'
import { useAtom } from 'jotai/react'
import { FileCheck2, FileWarning } from 'lucide-react'

import { processAtom } from '../../../lib/stores/publisher-config-store'

import { useToolbarContext } from './toolbar-context'

export function StatusIndicator() {
	const { isSaved, isSaving } = useToolbarContext()
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
		<div className="relative flex grow items-center justify-end gap-4 px-4">
			<Button
				disabled={showSidebar}
				size="sm"
				variant="ghost"
				onClick={handleOptimizeClick}
				className="text-muted-foreground inline-flex items-center gap-2 text-sm"
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
			</Button>

			<div
				className="mx-2 ml-1 h-5 w-px bg-neutral-700/50"
				aria-hidden="true"
			/>

			<div
				className={cn(
					'flex items-center gap-1.5 text-xs font-medium transition-all duration-300',
					isSaved
						? 'text-green-300'
						: isSaving
							? 'text-orange-300'
							: 'text-yellow-300'
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
									: 'bg-yellow-400 after:bg-yellow-400'
						)}
						aria-hidden="true"
					/>
				</div>
				{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Unsaved'}
			</div>
		</div>
	)
}
