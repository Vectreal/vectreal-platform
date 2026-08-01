import { motion } from 'framer-motion'

import { formatBytes, formatCount } from './metric-row'

import type { SizeInfo } from '../use-optimization-process'
import type { FC } from 'react'

interface PreOptimizationSummaryProps {
	primitivesCount: number | null | undefined
	texturesCount: number | null | undefined
	sizeInfo: SizeInfo
}

/** The at-a-glance row shown before any pass has run. */
export const PreOptimizationSummary: FC<PreOptimizationSummaryProps> = ({
	primitivesCount,
	texturesCount,
	sizeInfo
}) => {
	const metrics = [
		{ label: 'Triangles', value: formatCount(primitivesCount) },
		{ label: 'File size', value: formatBytes(sizeInfo.initialSceneBytes) },
		{ label: 'Textures', value: formatCount(texturesCount) }
	]

	return (
		<motion.div
			key="pre-opt-metrics"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
			className="flex items-center justify-around px-1 py-2"
		>
			{metrics.map(({ label, value }) => (
				<div key={label} className="text-center">
					<p className="text-muted-foreground/60 text-[10px] font-medium tracking-wide uppercase">
						{label}
					</p>
					<p className="text-muted-foreground text-sm font-medium tabular-nums">
						{value}
					</p>
				</div>
			))}
		</motion.div>
	)
}
