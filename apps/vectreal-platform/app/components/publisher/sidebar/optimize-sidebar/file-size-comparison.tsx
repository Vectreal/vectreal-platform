import { formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { motion } from 'framer-motion'
import { ArrowRightIcon } from 'lucide-react'

import type { SizeInfo } from './use-optimization-process'

interface FileSizeComparisonProps {
	info: OptimizationInfo
	sizeInfo: SizeInfo
}

export const FileSizeComparison: React.FC<FileSizeComparisonProps> = ({
	info,
	sizeInfo
}) => {
	const initialFileSize = sizeInfo.draftBytes ?? info.initial.sceneBytes
	const currentFileSize = sizeInfo.draftAfterBytes ?? info.optimized.sceneBytes
	const publishedFileSize = sizeInfo.publishedBytes ?? null
	const formatValue = (value: number | null) =>
		value === null ? '—' : formatFileSize(value)

	return (
		<div className="py-4">
			<div className="flex items-center justify-between">
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<div className="text-3xl font-bold">
						{formatValue(initialFileSize)}
					</div>
					<div className="text-sm text-zinc-400">Before (draft)</div>
				</motion.div>
				<ArrowRightIcon className="text-accent h-8 w-8 transform" />
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<div className="text-accent text-3xl font-bold">
						{formatValue(currentFileSize)}
					</div>
					<div className="text-sm text-zinc-400">After (draft)</div>
				</motion.div>
			</div>
			<p className="mt-3 text-center text-xs text-zinc-400">
				Published size (GLB): {formatValue(publishedFileSize)}
			</p>
		</div>
	)
}
