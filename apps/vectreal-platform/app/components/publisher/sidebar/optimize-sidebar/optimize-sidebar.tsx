import { Accordion } from '@shared/components/ui/accordion'
import { useAtomValue } from 'jotai'
import { useMemo, type FC } from 'react'

import {
	AdvancedOptimizationAccordionItem,
	BasicOptimizationAccordionItem,
	SceneDetailsAccordionItem,
	StatsAccordionItem
} from './accordion-items'
import { OptimizeButton } from './optimize-button'
import { useOptimizationProcess } from './use-optimization-process'
import { calculateOptimizationStats } from './utils'
import { processAtom } from '../../../../lib/stores/publisher-config-store'

const OptimizeSidebarContent: FC = () => {
	const {
		info,
		report,
		isPending,
		hasImproved,
		handleOptimizeClick,
		sizeInfo
	} = useOptimizationProcess()

	const { isSaving } = useAtomValue(processAtom)

	const optimizationStats = useMemo(
		() => calculateOptimizationStats(info, sizeInfo),
		[info, sizeInfo]
	)

	return (
		<>
			<Accordion type="single" className="space-y-2" collapsible>
				<StatsAccordionItem
					isPending={isPending}
					info={info}
					hasImproved={hasImproved}
					sizeInfo={sizeInfo}
					optimizationStats={optimizationStats}
					appliedOptimizations={report?.appliedOptimizations || []}
				/>
				<BasicOptimizationAccordionItem />
				<AdvancedOptimizationAccordionItem />
				<SceneDetailsAccordionItem
					info={info}
					report={report}
					sizeInfo={sizeInfo}
				/>
			</Accordion>
			<OptimizeButton
				onOptimize={handleOptimizeClick}
				disabled={isSaving}
				isPending={isPending}
				hasOptimized={hasImproved}
			/>
		</>
	)
}

export default OptimizeSidebarContent
