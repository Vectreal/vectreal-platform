import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { formatFileSize } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'
import { ArrowRightIcon } from 'lucide-react'

interface FileSizeComparisonProps {
	info: OptimizationInfo
}

export const FileSizeComparison: React.FC<FileSizeComparisonProps> = ({
	info
}) => {
	const initialFileSize = info.initial.sceneBytes
	const currentFileSize = info.optimized.sceneBytes

	return (
		<div className="flex items-center justify-between py-4">
			<motion.div
				className="text-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<div className="text-3xl font-bold">
					{formatFileSize(initialFileSize)}
				</div>
				<div className="text-sm text-zinc-400">Original</div>
			</motion.div>
			<ArrowRightIcon className="text-accent h-8 w-8 transform" />
			<motion.div
				className="text-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.2 }}
			>
				<div className="text-accent text-3xl font-bold">
					{formatFileSize(currentFileSize)}
				</div>
				<div className="text-sm text-zinc-400">Optimized</div>
			</motion.div>
		</div>
	)
}