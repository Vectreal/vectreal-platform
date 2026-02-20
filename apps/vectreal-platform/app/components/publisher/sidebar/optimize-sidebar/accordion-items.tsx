import { AccordionContent } from '@shared/components/ui/accordion'
import type { OptimizationReport } from '@vctrl/core'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { FileIcon, Settings2, Star } from 'lucide-react'
import type { FC } from 'react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'

import { AdvancedPanel } from './advanced-optimization-panel'
import BasicOptimizationPanel from './basic-optimization-panel'
import { OptimizationStats } from './optimization-stats'
import { OptimizationStatsHeader } from './optimization-stats-header'
import SceneDetails from './scene-details'
import type { SizeInfo } from './use-optimization-process'
import { OptimizationStat } from './utils'

interface AccordionItemsProps {
	info: OptimizationInfo
	hasImproved: boolean
	sizeInfo: SizeInfo
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

export const StatsAccordionItem: FC<AccordionItemsProps> = ({
	info,
	hasImproved,
	sizeInfo,
	optimizationStats,
	appliedOptimizations
}) => (
	<AccordionItem value="stats">
		<AccordionTrigger
			disabled={!hasImproved}
			className="px-2 hover:no-underline"
		>
			<OptimizationStatsHeader hasImproved={hasImproved} sizeInfo={sizeInfo} />
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
