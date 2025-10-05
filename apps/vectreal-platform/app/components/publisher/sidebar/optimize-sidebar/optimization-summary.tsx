import { motion } from 'framer-motion'
import { CheckIcon } from 'lucide-react'

import { InfoTooltip } from '../../../info-tooltip'

import {
	formatOptimizationName,
	getOptimizationDetails,
	getOptimizationIcon,
	getOptimizationStatMapping,
	OptimizationStat
} from './utils'

interface OptimizationSummaryProps {
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

export const OptimizationSummary: React.FC<OptimizationSummaryProps> = ({
	optimizationStats,
	appliedOptimizations
}) => {
	const getOptimizationImprovements = (optimization: string) => {
		const mappedStatNames = getOptimizationStatMapping(optimization)
		const improvements = mappedStatNames
			.map((statName) =>
				optimizationStats.find((stat) => stat.name === statName)
			)
			.filter(Boolean) as OptimizationStat[]

		if (improvements.length === 0) return null

		// Get the most significant improvement to display
		const primaryImprovement = improvements.reduce((max, current) =>
			current.reduction > max.reduction ? current : max
		)

		return primaryImprovement
	}

	return (
		<motion.div
			className="bg-muted/50 rounded-lg p-4"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, delay: 0.4 }}
		>
			<h4 className="mb-3 flex items-center text-sm font-semibold">
				Optimizations Applied
			</h4>
			{appliedOptimizations.length > 0 ? (
				<ul className="space-y-3">
					{appliedOptimizations.map((optimization, index) => {
						const details = getOptimizationDetails(optimization)
						const IconComponent = getOptimizationIcon(optimization)
						const improvement = getOptimizationImprovements(optimization)

						return (
							<motion.li
								key={index}
								className="flex flex-col gap-1 text-sm"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									delay: 0.6 + index * 0.1,
									duration: 0.3
								}}
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<InfoTooltip
											content={
												<div className="flex items-center gap-3">
													<IconComponent className="text-accent h-4 w-4 flex-shrink-0" />

													<div className="space-y-1">
														<p className="text-zinc-400">
															{details.description}
														</p>

														<p className="text-accent/80 italic">
															{details.benefit}
														</p>
													</div>
												</div>
											}
										/>
										<span className="font-medium text-zinc-300">
											{formatOptimizationName(optimization)}{' '}
											{improvement && (
												<span className="text-xs text-zinc-400">
													(-{improvement.reduction}%)
												</span>
											)}
										</span>
									</div>
									<CheckIcon className="text-accent h-4 w-4 flex-shrink-0" />
								</div>
							</motion.li>
						)
					})}
				</ul>
			) : (
				<p className="text-sm text-zinc-400">No optimizations applied yet</p>
			)}
		</motion.div>
	)
}
