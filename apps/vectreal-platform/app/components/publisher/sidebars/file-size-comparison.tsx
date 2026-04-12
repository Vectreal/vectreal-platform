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
}

export const FileSizeComparison: FC<FileSizeComparisonProps> = ({
	sizeInfo
}) => {
	const initialFileSize = sizeInfo.initialSceneBytes ?? null
	const currentFileSize = sizeInfo.currentSceneBytes ?? initialFileSize
	const isHydratingInitialMetrics =
		Boolean(sizeInfo.isInitialMetricsHydrating) && initialFileSize === null
	const formatValue = (value: number | null) =>
		value === null
			? isHydratingInitialMetrics
				? 'Loading...'
				: '—'
			: formatFileSize(value)

	return (
		<div className="py-4">
			<div className="flex items-center justify-between">
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<div className="text-accent text-3xl font-medium tracking-tight">
						{formatValue(initialFileSize)}
					</div>
					<div className="text-sm text-zinc-400">Before</div>
				</motion.div>
				<ArrowRightIcon className="text-accent h-8 w-8 transform" />
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<div className="text-primary text-3xl font-medium tracking-tight">
						{formatValue(currentFileSize)}
					</div>
					<div className="text-sm text-zinc-400">After</div>
				</motion.div>
			</div>
		</div>
	)
}
