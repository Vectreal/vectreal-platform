import { CardTitle } from '@shared/components/ui/card'
import { cn, formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { motion } from 'framer-motion'
import type { FC } from 'react'

import type { SizeInfo } from './use-optimization-process'

interface OptimizationStatsHeaderProps {
	info: OptimizationInfo
	hasImproved: boolean
	sizeInfo: SizeInfo
}

export const OptimizationStatsHeader: FC<OptimizationStatsHeaderProps> = ({
	info,
	hasImproved,
	sizeInfo
}) => {
	const initialDraftBytes = sizeInfo.draftBytes ?? info.initial.sceneBytes
	const optimizedDraftBytes =
		sizeInfo.draftAfterBytes ?? info.optimized.sceneBytes
	const optimizationPercentage =
		hasImproved &&
		typeof initialDraftBytes === 'number' &&
		typeof optimizedDraftBytes === 'number' &&
		initialDraftBytes > 0
			? Math.round(
					((initialDraftBytes - optimizedDraftBytes) / initialDraftBytes) * 100
				)
			: 0
	const displayOptimized =
		typeof optimizedDraftBytes === 'number'
			? formatFileSize(optimizedDraftBytes)
			: '—'
	const displayReduction =
		typeof initialDraftBytes === 'number' &&
		typeof optimizedDraftBytes === 'number'
			? formatFileSize(initialDraftBytes - optimizedDraftBytes)
			: '—'

	return (
		<CardTitle>
			<span className="inline-flex items-center justify-between gap-2">
				<p
					className={cn(
						'font-bold',
						hasImproved ? 'text-accent' : 'text-muted-foreground'
					)}
				>
					<motion.span
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1, duration: 0.5 }}
					>
						{optimizationPercentage}%
					</motion.span>{' '}
					optimization
				</p>
				<small className="text-muted-foreground text-xs font-light whitespace-nowrap">
					Now {displayOptimized}{' '}
				</small>
			</span>
			{hasImproved && (
				<p className="text-muted-foreground text-xs">
					{displayReduction} reduction
				</p>
			)}
		</CardTitle>
	)
}
