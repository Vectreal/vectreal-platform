import type { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import type { FC } from 'react'

import { FileSizeComparison } from './file-size-comparison'
import { OptimizationSummary } from './optimization-summary'
import type { SizeInfo } from './use-optimization-process'
import { OptimizationStat } from './utils'

interface OptimizationStatsProps {
	info: OptimizationInfo
	sizeInfo: SizeInfo
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

export const OptimizationStats: FC<OptimizationStatsProps> = ({
	info,
	sizeInfo,
	optimizationStats,
	appliedOptimizations
}) => {
	if (!optimizationStats.length) return null

	return (
		<>
			<FileSizeComparison info={info} sizeInfo={sizeInfo} />
			<OptimizationSummary
				optimizationStats={optimizationStats}
				appliedOptimizations={appliedOptimizations}
			/>
		</>
	)
}
