import { CardTitle } from '@shared/components/ui/card'
import { cn, formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { motion } from 'framer-motion'

interface OptimizationStatsHeaderProps {
	info: OptimizationInfo
	hasImproved: boolean
}

export const OptimizationStatsHeader: React.FC<
	OptimizationStatsHeaderProps
> = ({ info, hasImproved }) => {
	const optimizationPercentage = hasImproved
		? Math.round((info.improvement.sceneBytes / info.initial.sceneBytes) * 100)
		: 0

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
					Now {formatFileSize(info.optimized.sceneBytes)}{' '}
				</small>
			</span>
			{hasImproved && (
				<p className="text-muted-foreground text-xs">
					{formatFileSize(info.improvement.sceneBytes)} reduction
				</p>
			)}
		</CardTitle>
	)
}
