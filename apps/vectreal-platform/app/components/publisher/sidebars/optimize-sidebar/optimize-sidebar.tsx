import { Accordion } from '@shared/components/ui/accordion'
import { Progress } from '@shared/components/ui/progress'
import { useAtomValue } from 'jotai'
import { useMemo, type FC } from 'react'

import {
	AdvancedOptimizationAccordionItem,
	BasicOptimizationAccordionItem,
	StatsAccordionItem
} from './accordion-items'
import { OptimizeButton } from './optimize-button'
import { useOptimizationProcess } from './use-optimization-process'
import { calculateOptimizationStats } from './utils'
import { processAtom } from '../../../../lib/stores/publisher-config-store'

interface OptimizeSidebarContentProps {
	userId?: string
}

const OptimizeSidebarContent: FC<OptimizeSidebarContentProps> = ({
	userId
}) => {
	const isAuthenticated = Boolean(userId)
	const {
		info,
		report,
		isPending,
		isOptimizerPreparing,
		hasImproved,
		handleOptimizeClick,
		sizeInfo,
		guestQuota
	} = useOptimizationProcess({ isAuthenticated })

	const { isSaving } = useAtomValue(processAtom)

	const optimizationStats = useMemo(
		() => calculateOptimizationStats(info, sizeInfo),
		[info, sizeInfo]
	)

	const quotaPercent = useMemo(() => {
		if (!guestQuota || guestQuota.limit <= 0) {
			return 0
		}

		return Math.min(
			100,
			Math.round((guestQuota.currentValue / guestQuota.limit) * 100)
		)
	}, [guestQuota])

	return (
		<>
			{!isAuthenticated && guestQuota && (
				<div className="px-2 pt-1 pb-2">
					<div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] tracking-wide uppercase">
						<span>Guest optimization quota</span>
						<span>{guestQuota.remaining} left today</span>
					</div>
					<Progress value={quotaPercent} className="h-1 rounded-sm" />
				</div>
			)}
			<Accordion
				type="single"
				defaultValue="basic"
				className="space-y-2"
				collapsible
			>
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
			</Accordion>
			<OptimizeButton
				onOptimize={handleOptimizeClick}
				disabled={isSaving || isOptimizerPreparing}
				isPreparing={isOptimizerPreparing}
				isPending={isPending}
				hasOptimized={hasImproved}
			/>
		</>
	)
}

export default OptimizeSidebarContent
