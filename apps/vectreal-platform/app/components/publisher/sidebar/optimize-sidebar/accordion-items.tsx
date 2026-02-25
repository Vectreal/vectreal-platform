import { AccordionContent } from '@shared/components/ui/accordion'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { AnimatePresence, motion } from 'framer-motion'
import { FileIcon, Settings2, Star } from 'lucide-react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'
import { AdvancedPanel } from './advanced-optimization-panel'
import BasicOptimizationPanel from './basic-optimization-panel'
import { OptimizationStats } from './optimization-stats'
import { OptimizationStatsHeader } from './optimization-stats-header'
import SceneDetails from './scene-details'
import { OptimizationStat } from './utils'
import CenteredSpinner from '../../../centered-spinner'

import type { SizeInfo } from './use-optimization-process'
import type { OptimizationReport } from '@vctrl/core'
import type { FC } from 'react'

interface AccordionItemsProps {
	info: OptimizationInfo
	isPending?: boolean
	hasImproved: boolean
	sizeInfo: SizeInfo
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

const REVEAL_DELAY = 1 // seconds
const REVEAL_DURATION = 0.5 // seconds
const revealTransition = {
	duration: REVEAL_DURATION,
	delay: REVEAL_DELAY
}

export const StatsAccordionItem: FC<AccordionItemsProps> = ({
	info,
	isPending = false,
	hasImproved,
	sizeInfo,
	optimizationStats,
	appliedOptimizations
}) => (
	<AnimatePresence mode="wait">
		{hasImproved && !isPending && (
			<motion.div
				key="stats-accordion-item"
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: 'auto' }}
				exit={{ opacity: 0, height: 0 }}
				transition={revealTransition}
			>
				<AccordionItem value="stats">
					<AccordionTrigger
						disabled={!hasImproved}
						className="px-2 hover:no-underline"
					>
						<OptimizationStatsHeader
							hasImproved={hasImproved}
							sizeInfo={sizeInfo}
						/>
					</AccordionTrigger>
					<AccordionContent>
						<OptimizationStats
							info={info}
							sizeInfo={sizeInfo}
							optimizationStats={optimizationStats}
							appliedOptimizations={appliedOptimizations}
						/>
					</AccordionContent>
				</AccordionItem>
			</motion.div>
		)}

		{isPending && (
			<motion.div
				key="stats-accordion-item-loader"
				className="bg-muted rounded-md p-4 text-center"
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: 'auto' }}
				exit={{
					opacity: 0,
					height: 0,
					transition: { duration: REVEAL_DURATION }
				}}
			>
				<CenteredSpinner>
					<p>Optimizing scene...</p>
					<small className="text-muted-foreground">
						This may take a few moments depending on the scene complexity and
						your internet connection.
					</small>
				</CenteredSpinner>
			</motion.div>
		)}
	</AnimatePresence>
)

export const BasicOptimizationAccordionItem: FC = () => (
	<AccordionItem value="basic">
		<AccordionTrigger>
			<Star className="inline" size={14} />
			Optimization
		</AccordionTrigger>
		<AccordionContent>
			<BasicOptimizationPanel />
		</AccordionContent>
	</AccordionItem>
)

export const AdvancedOptimizationAccordionItem: FC = () => (
	<AccordionItem value="advanced">
		<AccordionTrigger>
			<Settings2 className="inline" size={14} />
			Advanced Optimization
		</AccordionTrigger>
		<AccordionContent>
			<AdvancedPanel />
		</AccordionContent>
	</AccordionItem>
)

interface SceneDetailsAccordionItemProps {
	info: OptimizationInfo // from the optimization hook package
	report?: OptimizationReport | null // from the optimization core package
	sizeInfo: SizeInfo
}

export const SceneDetailsAccordionItem: FC<SceneDetailsAccordionItemProps> = ({
	info,
	report,
	sizeInfo
}) => (
	<AccordionItem value="details">
		<AccordionTrigger>
			<FileIcon className="inline" size={14} />
			Scene Details
		</AccordionTrigger>
		<AccordionContent>
			<SceneDetails info={info} report={report} sizeInfo={sizeInfo} />
		</AccordionContent>
	</AccordionItem>
)
