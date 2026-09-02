import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import { formatFileSize } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, type FC } from 'react'
import { Link } from 'react-router'

import { OptimizeButton } from './optimize-button'
import { AdvancedPanel } from './panels/advanced-panel'
import { PresetPanel } from './panels/preset-panel'
import { OptimizationProgress } from './progress/optimization-progress'
import { OptimizationResults } from './results/optimization-results'
import { PreOptimizationSummary } from './results/pre-optimization-summary'
import { SceneNormalizationNotice } from './scene-normalization-notice'
import { useOptimizationProcess } from './use-optimization-process'
import { useOptimizationSettings } from './use-optimization-settings'
import { DASHBOARD_ROUTES } from '../../../constants/dashboard'
import { PUBLISHER_LAYER } from '../shell/shell-layout'
import { DynamicSidebar } from '../sidebars/dynamic-sidebar'

interface OptimizationDrawerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	isOverSizeLimit: boolean
	maxSceneBytes: number | null
	dashboardHref?: string
	isMobile: boolean
}

const OptimizationDrawer: FC<OptimizationDrawerProps> = ({
	open,
	onOpenChange,
	isOverSizeLimit,
	maxSceneBytes,
	dashboardHref,
	isMobile
}) => {
	const { optimizationPreset } = useOptimizationSettings()
	const {
		info,
		dracoReport,
		simplificationOutcome,
		resolvedMetrics,
		sizeInfo,
		isPending,
		hasCompletedOptimizationPass,
		handleOptimizeClick,
		handleStackOptimizeClick,
		isOptimizerPreparing,
		optimizingStep
	} = useOptimizationProcess()

	// Soft-gate: only an in-progress optimization blocks closing. Being over the
	// size limit keeps save disabled (server 402 is the hard backstop) but never
	// traps the user in the drawer.
	const isBlockingClose = isPending

	useEffect(() => {
		if (!open || !isPending) return

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue =
				'Optimization is running. Leaving now may interrupt your changes.'
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => window.removeEventListener('beforeunload', handleBeforeUnload)
	}, [open, isPending])

	const drawerDescription = useMemo(() => {
		if (isPending) {
			return 'Applying optimization. Please keep this open until it completes.'
		}

		if (isOverSizeLimit && typeof maxSceneBytes === 'number') {
			const current =
				typeof sizeInfo.currentSceneBytes === 'number'
					? formatFileSize(sizeInfo.currentSceneBytes)
					: 'This scene'
			return `${current} exceeds your plan's ${formatFileSize(maxSceneBytes)} max scene size. Optimize to get under ${formatFileSize(maxSceneBytes)} to save.`
		}

		return 'Adjust options and run another optimization pass.'
	}, [isOverSizeLimit, maxSceneBytes, isPending, sizeInfo.currentSceneBytes])

	const resolvedDashboardHref = dashboardHref ?? DASHBOARD_ROUTES.DASHBOARD
	// Over the limit, "Continue to Composition" points away from the only action
	// that unblocks saving, so an already-optimized scene that is still too large
	// keeps the single-action layout and re-optimizing stays the primary CTA.
	const shouldShowCompletionActions =
		!isPending && hasCompletedOptimizationPass && !isOverSizeLimit

	return (
		<DynamicSidebar
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && isBlockingClose) return
				onOpenChange(nextOpen)
			}}
			zIndexClassName={PUBLISHER_LAYER.sidebar}
			closeDisabled={isBlockingClose}
			isMobile={isMobile}
			direction="left"
			title="Optimize Scene"
			description={drawerDescription}
			showMobileHeader={false}
			className="w-[min(34rem,calc(100vw-1rem))]"
		>
			{/* No background of its own — DynamicSidebar's panel supplies the surface. */}
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="border-shell-border-soft shrink-0 border-b px-5 py-4">
					<div className="flex items-start justify-between gap-2">
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2 }}
							className="flex flex-col gap-0.5"
						>
							<div className="flex items-center gap-2">
								<h2 className="text-base font-semibold">Optimize Scene</h2>
								{!isPending && (
									<span className="bg-shell-surface-soft text-muted-foreground rounded-lg px-2 py-0.5 text-[11px]">
										{optimizationPreset}
									</span>
								)}
							</div>
							<p className="text-muted-foreground text-xs">
								{drawerDescription}
							</p>
						</motion.div>
						{!isBlockingClose && (
							<Button
								variant="ghost"
								size="icon"
								className="publisher-shell-focus shrink-0"
								onClick={() => onOpenChange(false)}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>

				<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
					<AnimatePresence mode="wait">
						{isPending ? (
							<OptimizationProgress key="processing" steps={optimizingStep} />
						) : (
							<motion.div
								key="config"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="space-y-3 px-5 py-4"
							>
								<AnimatePresence mode="wait">
									{hasCompletedOptimizationPass ? (
										<OptimizationResults
											key="post-opt-metrics"
											sizeInfo={sizeInfo}
											resolvedMetrics={resolvedMetrics}
											dracoReport={dracoReport}
											simplificationOutcome={simplificationOutcome}
										/>
									) : (
										<PreOptimizationSummary
											key="pre-opt-metrics"
											primitivesCount={info?.initial.primitivesCount}
											texturesCount={info?.initial.texturesCount}
											sizeInfo={sizeInfo}
										/>
									)}
								</AnimatePresence>

								<SceneNormalizationNotice />

								<motion.section
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.2, delay: 0.02 }}
								>
									<PresetPanel />
								</motion.section>

								<motion.section
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.2, delay: 0.08 }}
								>
									<Accordion type="single" collapsible className="space-y-3">
										<AccordionItem
											value="advanced"
											className="bg-shell-surface-soft/50 rounded-2xl px-4 shadow-sm"
										>
											<AccordionTrigger className="py-3">
												<div className="flex items-center gap-2.5 text-left">
													<SlidersHorizontal className="text-muted-foreground h-4 w-4 shrink-0" />
													<div>
														<p className="text-sm font-semibold">
															Advanced controls
														</p>
														<p className="text-muted-foreground text-xs">
															Fine-tune compression, textures, and geometry.
														</p>
													</div>
												</div>
											</AccordionTrigger>
											<AccordionContent>
												<div className="pb-2">
													<AdvancedPanel />
												</div>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								</motion.section>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				<div className="border-shell-border-soft shrink-0 border-t px-5 py-4">
					<div className="flex flex-row justify-between gap-3">
						{isOverSizeLimit && !isPending ? (
							<Button type="button" variant="ghost" asChild>
								<Link to={resolvedDashboardHref}>Back to Dashboard</Link>
							</Button>
						) : null}
						{shouldShowCompletionActions ? (
							<>
								<OptimizeButton
									onOptimize={handleOptimizeClick}
									onStackOptimize={handleStackOptimizeClick}
									isPending={isPending}
									mode="optimize-more"
									isPreparing={isOptimizerPreparing}
								/>
								<Button
									type="button"
									className="grow"
									onClick={() => onOpenChange(false)}
								>
									Continue to Composition
								</Button>
							</>
						) : (
							<div className="w-full sm:w-[18rem]">
								<OptimizeButton
									onOptimize={handleOptimizeClick}
									onStackOptimize={handleStackOptimizeClick}
									isPending={isPending}
									mode={
										hasCompletedOptimizationPass ? 'optimize-more' : 'apply'
									}
									isPreparing={isOptimizerPreparing}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</DynamicSidebar>
	)
}

export default OptimizationDrawer
