import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { Progress } from '@shared/components/ui/progress'
import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import {
	CheckCircle2,
	Circle,
	Sparkles,
	SlidersHorizontal,
	X
} from 'lucide-react'
import { useEffect, useMemo, type FC } from 'react'
import { Link } from 'react-router'

import { AdvancedPanel } from './optimization/advanced-optimization-panel'
import BasicOptimizationPanel from './optimization/basic-optimization-panel'
import { OptimizeButton } from './optimization/optimize-button'
import { useOptimizationProcess } from './optimization/use-optimization-process'
import { DynamicSidebar } from './sidebars/dynamic-sidebar'
import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../lib/stores/scene-optimization-store'

interface OptimizationModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	userId?: string
	isInitialRequired: boolean
	dashboardHref?: string
	isMobile: boolean
}

const OptimizationDrawer: FC<OptimizationModalProps> = ({
	open,
	onOpenChange,
	userId,
	isInitialRequired,
	dashboardHref,
	isMobile
}) => {
	const { optimizationPreset } = useAtomValue(optimizationAtom)
	const { isPending } = useAtomValue(optimizationRuntimeAtom)
	const {
		hasCompletedOptimizationPass,
		handleOptimizeClick,
		guestQuota,
		isOptimizerPreparing,
		optimizingStep
	} = useOptimizationProcess({ isAuthenticated: Boolean(userId) })
	const canProgressToComposition = hasCompletedOptimizationPass
	const isBlockingClose =
		isPending || (isInitialRequired && !canProgressToComposition)

	const quotaPercent = useMemo(() => {
		if (!guestQuota || guestQuota.limit <= 0) {
			return 0
		}

		return Math.min(
			100,
			Math.round((guestQuota.currentValue / guestQuota.limit) * 100)
		)
	}, [guestQuota])

	useEffect(() => {
		if (!open || !isPending) {
			return
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue =
				'Optimization is running. Leaving now may interrupt your changes.'
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
		}
	}, [open, isPending])

	const drawerDescription = useMemo(() => {
		if (isPending) {
			return 'Applying optimization. Please keep this open until it completes.'
		}

		if (isInitialRequired) {
			return 'Run one optimization pass to unlock save and publish.'
		}

		return 'Adjust options and run another optimization pass.'
	}, [isInitialRequired, isPending])

	const runOptimization = async () => {
		await handleOptimizeClick()
	}

	const resolvedDashboardHref = dashboardHref ?? DASHBOARD_ROUTES.DASHBOARD

	const progressPercent =
		optimizingStep.allSteps.length > 0
			? Math.round(
					(optimizingStep.completed.length / optimizingStep.allSteps.length) *
						100
				)
			: 0
	const shouldShowCompletionActions = !isPending && canProgressToComposition
	const optimizeButtonMode = shouldShowCompletionActions
		? 'optimize-more'
		: 'apply'
	const completionActionWidthClass = 'w-full sm:w-[18rem]'

	return (
		<DynamicSidebar
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && isBlockingClose) {
					return
				}
				onOpenChange(nextOpen)
			}}
			zIndexClassName="z-[70]"
			closeDisabled={isBlockingClose}
			isMobile={isMobile}
			direction="left"
			title="Optimize Scene"
			description={drawerDescription}
			showMobileHeader={false}
			className="w-[min(34rem,calc(100vw-1rem))]"
		>
			<div className="bg-shell-surface flex min-h-0 flex-1 flex-col">
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
							<motion.div
								key="processing"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								transition={{ duration: 0.25 }}
								className="flex flex-col items-center px-6 py-10"
							>
								<div className="mb-6 flex flex-col items-center gap-3 text-center">
									<div className="relative flex h-16 w-16 items-center justify-center">
										<div
											className="bg-primary/10 absolute inset-0 animate-ping rounded-full"
											style={{ animationDuration: '2s' }}
										/>
										<div
											className="bg-primary/15 absolute inset-2 animate-ping rounded-full"
											style={{
												animationDuration: '2s',
												animationDelay: '0.4s'
											}}
										/>
										<div className="border-primary/20 bg-primary/10 relative flex h-10 w-10 items-center justify-center rounded-full border">
											<Sparkles className="text-primary h-5 w-5" />
										</div>
									</div>
									<p className="text-sm font-medium">Processing your scene</p>
									<p className="text-muted-foreground max-w-xs text-xs">
										Do not close this panel while optimization is in progress.
									</p>
								</div>

								{optimizingStep.allSteps.length > 0 && (
									<div className="mb-6 w-full max-w-sm">
										<Progress value={progressPercent} className="h-1" />
										<p className="text-muted-foreground mt-1.5 text-right text-[11px]">
											{optimizingStep.completed.length} /{' '}
											{optimizingStep.allSteps.length} steps
										</p>
									</div>
								)}

								<div className="w-full max-w-sm space-y-1">
									{optimizingStep.allSteps.map((step) => {
										const isDone = optimizingStep.completed.includes(step)
										const isRunning = optimizingStep.current === step && !isDone
										return (
											<motion.div
												key={step}
												layout
												className={cn(
													'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-300',
													isRunning && 'bg-primary/5'
												)}
											>
												<div className="shrink-0">
													{isDone ? (
														<CheckCircle2 className="h-4 w-4 text-green-500" />
													) : isRunning ? (
														<LoadingSpinner className="h-4 w-4" />
													) : (
														<Circle className="text-muted-foreground/30 h-4 w-4" />
													)}
												</div>
												<span
													className={cn(
														'transition-colors duration-300',
														isDone
															? 'text-muted-foreground line-through'
															: isRunning
																? 'text-foreground font-medium'
																: 'text-muted-foreground'
													)}
												>
													{step}
												</span>
											</motion.div>
										)
									})}
								</div>
							</motion.div>
						) : (
							<motion.div
								key="config"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="space-y-3 px-5 py-4"
							>
								<motion.section
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.2, delay: 0.02 }}
								>
									<BasicOptimizationPanel />
								</motion.section>

								{!userId && guestQuota && (
									<motion.div
										initial={{ opacity: 0, y: 6 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.2, delay: 0.06 }}
										className="publisher-shell-nested px-4 py-3"
									>
										<div className="text-muted-foreground mb-2 flex items-center justify-between text-xs tracking-wide uppercase">
											<span>Guest optimization quota</span>
											<span>{guestQuota.remaining} left today</span>
										</div>
										<Progress value={quotaPercent} className="h-1.5" />
									</motion.div>
								)}

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
															Fine-tune mesh, texture, and geometry settings.
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

				<div className="border-shell-border-soft bg-shell-surface shrink-0 border-t px-5 py-4">
					<div className="flex flex-col gap-3">
						{isInitialRequired && !isPending ? (
							<Button type="button" variant="ghost" asChild>
								<Link to={resolvedDashboardHref}>Back to Dashboard</Link>
							</Button>
						) : null}
						{shouldShowCompletionActions ? (
							<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
								<div className={completionActionWidthClass}>
									<OptimizeButton
										onOptimize={runOptimization}
										isPending={isPending}
										mode={optimizeButtonMode}
										hierarchy="secondary"
										isPreparing={isOptimizerPreparing}
										fixedBottom={false}
									/>
								</div>
								<Button
									type="button"
									className={completionActionWidthClass}
									onClick={() => onOpenChange(false)}
								>
									Continue to Composition
								</Button>
							</div>
						) : (
							<div className="w-full sm:w-[18rem]">
								<OptimizeButton
									onOptimize={runOptimization}
									isPending={isPending}
									mode={optimizeButtonMode}
									hierarchy="primary"
									isPreparing={isOptimizerPreparing}
									fixedBottom={false}
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
