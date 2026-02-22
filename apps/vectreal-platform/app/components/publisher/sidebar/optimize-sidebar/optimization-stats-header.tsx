import { CardTitle } from '@shared/components/ui/card'
import { cn, formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'

import type { SizeInfo } from './use-optimization-process'
import type { FC } from 'react'


interface OptimizationStatsHeaderProps {
	hasImproved: boolean
	sizeInfo: SizeInfo
}

export const OptimizationStatsHeader: FC<OptimizationStatsHeaderProps> = ({
	hasImproved,
	sizeInfo
}) => {
	const initialSceneBytes = sizeInfo.initialSceneBytes ?? null
	const currentSceneBytes = sizeInfo.currentSceneBytes ?? initialSceneBytes
	const optimizationPercentage =
		hasImproved &&
		typeof initialSceneBytes === 'number' &&
		typeof currentSceneBytes === 'number' &&
		initialSceneBytes > 0
			? Math.round(
					((initialSceneBytes - currentSceneBytes) / initialSceneBytes) * 100
				)
			: 0
	const displayOptimized =
		typeof currentSceneBytes === 'number'
			? formatFileSize(currentSceneBytes)
			: '—'
	const displayReduction =
		typeof initialSceneBytes === 'number' &&
		typeof currentSceneBytes === 'number'
			? formatFileSize(initialSceneBytes - currentSceneBytes)
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
