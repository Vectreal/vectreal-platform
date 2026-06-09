import { formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { ArrowRightIcon } from 'lucide-react'

import type { FC } from 'react'

export interface FileSizeComparisonSizeInfo {
	initialSceneBytes?: number | null
	currentSceneBytes?: number | null
	isInitialMetricsHydrating?: boolean
}

interface FileSizeComparisonProps {
	sizeInfo: FileSizeComparisonSizeInfo
	reductionPercent?: number | null
	deltaLabel?: string | null
}

export const FileSizeComparison: FC<FileSizeComparisonProps> = ({
	sizeInfo,
	reductionPercent,
	deltaLabel
}) => {
	const initialFileSize = sizeInfo.initialSceneBytes ?? null
	const currentFileSize = sizeInfo.currentSceneBytes ?? initialFileSize
	const isHydratingInitialMetrics =
		Boolean(sizeInfo.isInitialMetricsHydrating) && initialFileSize === null
	const formatValue = (value: number | null) =>
		value === null
			? isHydratingInitialMetrics
				? 'Loading...'
				: '-'
			: formatFileSize(value)

	const showReduction = reductionPercent != null && deltaLabel != null

	return (
		<div className="py-3">
			<div className="flex items-center justify-between gap-2">
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<div className="text-accent text-3xl font-medium tracking-tight">
						{formatValue(initialFileSize)}
					</div>
					<div className="text-muted-foreground text-sm">Before</div>
				</motion.div>

				<motion.div
					className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.4, delay: 0.15 }}
				>
					{showReduction && (
						<span className="text-primary text-sm font-semibold leading-none">
							-{reductionPercent}%
						</span>
					)}
					<ArrowRightIcon className="text-muted-foreground/50 h-5 w-5 shrink-0" />
					{showReduction && (
						<span className="text-muted-foreground text-[11px] leading-none">
							{deltaLabel}
						</span>
					)}
				</motion.div>

				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<div className="text-primary text-3xl font-medium tracking-tight">
						{formatValue(currentFileSize)}
					</div>
					<div className="text-muted-foreground text-sm">After</div>
				</motion.div>
			</div>
		</div>
	)
}
