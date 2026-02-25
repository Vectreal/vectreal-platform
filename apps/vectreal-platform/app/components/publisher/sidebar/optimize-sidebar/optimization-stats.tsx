
import { FileSizeComparison } from './file-size-comparison'
import { OptimizationSummary } from './optimization-summary'
import { OptimizationStat } from './utils'

import type { SizeInfo } from './use-optimization-process'
import type { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import type { FC } from 'react'

interface OptimizationStatsProps {
	info: OptimizationInfo
	sizeInfo: SizeInfo
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

export const OptimizationStats: FC<OptimizationStatsProps> = ({
	info: _info,
	sizeInfo,
	optimizationStats,
	appliedOptimizations
}) => {
	if (!optimizationStats.length) return null

	return (
		<>
			<FileSizeComparison sizeInfo={sizeInfo} />
			<OptimizationSummary
				optimizationStats={optimizationStats}
				appliedOptimizations={appliedOptimizations}
			/>
		</>
	)
}
