import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { AccordionContent } from '@vctrl-ui/ui/accordion'
import { FileIcon, Settings2, Star } from 'lucide-react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'

import { AdvancedPanel } from './advanced-optimization-panel'
import BasicOptimizationPanel from './basic-optimization-panel'
import { OptimizationStats } from './optimization-stats'
import { OptimizationStatsHeader } from './optimization-stats-header'
import SceneDetails from './scene-details'
import { OptimizationStat } from './utils'

interface AccordionItemsProps {
	info: OptimizationInfo
	hasImproved: boolean
	optimizationStats: OptimizationStat[]
	appliedOptimizations: string[]
}

export const StatsAccordionItem: React.FC<AccordionItemsProps> = ({
	info,
	hasImproved,
	optimizationStats,
	appliedOptimizations
}) => (
	<AccordionItem value="stats">
		<AccordionTrigger
			disabled={!hasImproved}
			className="px-2 hover:no-underline"
		>
			<OptimizationStatsHeader info={info} hasImproved={hasImproved} />
		</AccordionTrigger>
		<AccordionContent>
			<OptimizationStats
				info={info}
				optimizationStats={optimizationStats}
				appliedOptimizations={appliedOptimizations}
			/>
		</AccordionContent>
	</AccordionItem>
)

export const BasicOptimizationAccordionItem: React.FC = () => (
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

export const AdvancedOptimizationAccordionItem: React.FC = () => (
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
	info: OptimizationInfo
}

export const SceneDetailsAccordionItem: React.FC<
	SceneDetailsAccordionItemProps
> = ({ info }) => (
	<AccordionItem value="details">
		<AccordionTrigger>
			<FileIcon className="inline" size={14} />
			Scene Details
		</AccordionTrigger>
		<AccordionContent>
			<SceneDetails info={info} />
		</AccordionContent>
	</AccordionItem>
)
