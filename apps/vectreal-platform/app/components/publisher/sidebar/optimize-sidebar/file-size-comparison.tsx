import { formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { ArrowRightIcon } from 'lucide-react'
import type { FC } from 'react'

import type { SizeInfo } from './use-optimization-process'

interface FileSizeComparisonProps {
	sizeInfo: SizeInfo
}

export const FileSizeComparison: FC<FileSizeComparisonProps> = ({
	sizeInfo
}) => {
	const initialFileSize = sizeInfo.initialSceneBytes ?? null
	const currentFileSize = sizeInfo.currentSceneBytes ?? initialFileSize
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
					<div className="text-sm text-zinc-400">Before</div>
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
					<div className="text-sm text-zinc-400">After</div>
				</motion.div>
			</div>
		</div>
	)
}
