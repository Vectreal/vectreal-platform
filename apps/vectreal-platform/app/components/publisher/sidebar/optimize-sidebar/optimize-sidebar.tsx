import { Accordion } from '@shared/components/ui/accordion'
import { useMemo } from 'react'

import {
	AdvancedOptimizationAccordionItem,
	BasicOptimizationAccordionItem,
	SceneDetailsAccordionItem,
	StatsAccordionItem
} from './accordion-items'
import { OptimizeButton } from './optimize-button'
import { useOptimizationProcess } from './use-optimization-process'
import { calculateOptimizationStats } from './utils'

const OptimizeSidebarContent: React.FC = () => {
	const {
		info,
		report,
		isPending,
		hasImproved,
		handleOptimizeClick,
		sizeInfo
	} = useOptimizationProcess()

	const optimizationStats = useMemo(
		() => calculateOptimizationStats(info, sizeInfo),
		[info, sizeInfo]
	)

	return (
		<>
			<Accordion type="single" className="space-y-2" collapsible>
				<StatsAccordionItem
					info={info}
					hasImproved={hasImproved}
					sizeInfo={sizeInfo}
					optimizationStats={optimizationStats}
					appliedOptimizations={report?.appliedOptimizations || []}
				/>
				<BasicOptimizationAccordionItem />
				<AdvancedOptimizationAccordionItem />
				<SceneDetailsAccordionItem info={info} report={report} />
			</Accordion>
			<OptimizeButton
				onOptimize={handleOptimizeClick}
				isPending={isPending}
				hasOptimized={hasImproved}
			/>
		</>
	)
}

export default OptimizeSidebarContent
