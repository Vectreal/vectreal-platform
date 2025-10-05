import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'

import { FileSizeComparison } from './file-size-comparison'
import { OptimizationSummary } from './optimization-summary'
import { OptimizationStat } from './utils'

interface OptimizationStatsProps {
	info: OptimizationInfo
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

export const OptimizationStats: React.FC<OptimizationStatsProps> = ({
	info,
	optimizationStats,
	appliedOptimizations
}) => {
	if (!optimizationStats.length) return null

	return (
		<>
			<FileSizeComparison info={info} />
			<OptimizationSummary
				optimizationStats={optimizationStats}
				appliedOptimizations={appliedOptimizations}
			/>
		</>
	)
}
