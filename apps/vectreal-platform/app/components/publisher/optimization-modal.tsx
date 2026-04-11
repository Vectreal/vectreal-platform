import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Progress } from '@shared/components/ui/progress'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, type FC } from 'react'

import { AdvancedPanel } from './sidebars/optimize-sidebar/advanced-optimization-panel'
import BasicOptimizationPanel from './sidebars/optimize-sidebar/basic-optimization-panel'
import { OptimizeButton } from './sidebars/optimize-sidebar/optimize-button'
import { useOptimizationProcess } from './sidebars/optimize-sidebar/use-optimization-process'
import { calculateOptimizationStats } from './sidebars/optimize-sidebar/utils'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../lib/stores/scene-optimization-store'

interface OptimizationModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	userId?: string
	isInitialRequired: boolean
}

const OptimizationModal: FC<OptimizationModalProps> = ({
	open,
	onOpenChange,
	userId,
	isInitialRequired
}) => {
	const { optimizationPreset, optimizations } = useAtomValue(optimizationAtom)
	const { isPending } = useAtomValue(optimizationRuntimeAtom)
	const {
		info,
		hasImproved,
		handleOptimizeClick,
		sizeInfo,
		guestQuota,
		isOptimizerPreparing
	} = useOptimizationProcess({ isAuthenticated: Boolean(userId) })
	const isBlockingClose = isPending || isInitialRequired

	const optimizationStats = useMemo(
		() => calculateOptimizationStats(info, sizeInfo),
		[info, sizeInfo]
	)

	const enabledOptimizations = useMemo(() => {
		const labelMap: Record<string, string> = {
			simplification: 'Mesh simplification',
			texture: 'Texture optimization',
			quantize: 'Vertex quantization',
			dedup: 'Duplicate removal',
			normals: 'Normal refinement'
		}

		return Object.entries(optimizations)
			.filter(([, value]) => Boolean(value?.enabled))
			.map(([name]) => labelMap[name] ?? name)
	}, [optimizations])

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

	const modalDescription = useMemo(() => {
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

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && isBlockingClose) {
					return
				}
				onOpenChange(nextOpen)
			}}
		>
			<DialogContent
				className="h-[min(88svh,52rem)] w-[min(52rem,calc(100%-2rem))] max-w-none overflow-hidden border-0 p-0"
				showCloseButton={!isBlockingClose}
				onEscapeKeyDown={(event) => {
					if (isBlockingClose) {
						event.preventDefault()
					}
				}}
				onInteractOutside={(event) => {
					if (isBlockingClose) {
						event.preventDefault()
					}
				}}
			>
				<div className="bg-background flex h-full min-h-0 flex-col">
					<DialogHeader className="border-b px-6 pt-6 pb-4 text-left">
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2 }}
							className="space-y-1"
						>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
									<Sparkles className="h-3.5 w-3.5" />
									Optimize
								</span>
								<span className="text-muted-foreground rounded border px-2 py-0.5 text-[11px]">
									Preset: {optimizationPreset}
								</span>
							</div>
							<DialogTitle className="text-lg">Optimize Scene</DialogTitle>
							<DialogDescription className="text-sm">
								{modalDescription}
							</DialogDescription>
						</motion.div>
					</DialogHeader>

					<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
						<motion.section
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2, delay: 0.03 }}
							className="rounded-xl border px-4 py-3"
						>
							<p className="text-sm font-medium">What this pass will do</p>
							<p className="text-muted-foreground mt-1 text-xs">
								{enabledOptimizations.length} techniques selected
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{enabledOptimizations.map((item) => (
									<span
										key={item}
										className="bg-muted text-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-xs"
									>
										{item}
									</span>
								))}
							</div>
						</motion.section>

						{!userId && guestQuota && (
							<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.2, delay: 0.06 }}
								className="bg-muted/30 mt-4 rounded-xl border px-4 py-3"
							>
								<div className="text-muted-foreground mb-2 flex items-center justify-between text-xs uppercase tracking-wide">
									<span>Guest optimization quota</span>
									<span>{guestQuota.remaining} left today</span>
								</div>
								<Progress value={quotaPercent} className="h-1.5" />
							</motion.div>
						)}

						<motion.section
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2, delay: 0.08 }}
							className="space-y-3 pt-4"
						>
							<div>
								<p className="text-sm font-semibold">Options</p>
								<p className="text-muted-foreground text-xs">
									Pick a preset, then refine only if needed.
								</p>
							</div>
							<div className="rounded-2xl border px-4 py-4">
								<BasicOptimizationPanel />
							</div>
						</motion.section>

						<motion.section
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2, delay: 0.1 }}
							className="pt-4"
						>
							<Accordion type="single" collapsible className="space-y-3">
								<AccordionItem value="summary" className="rounded-2xl border px-4">
									<AccordionTrigger className="py-3">
										<div className="flex items-center gap-2 text-left">
											<Sparkles className="h-4 w-4" />
											<div>
												<p className="text-sm font-semibold">Expected effects</p>
												<p className="text-muted-foreground text-xs">
													{enabledOptimizations.length} optimizations selected
												</p>
											</div>
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-3 pb-2">
											<div className="grid gap-2 sm:grid-cols-2">
												{optimizationStats.length > 0 ? (
													optimizationStats.map((stat) => (
														<div
															key={stat.name}
															className="bg-muted/35 rounded-lg border px-3 py-2"
														>
															<p className="text-muted-foreground text-xs capitalize">
																{stat.name} reduction
															</p>
															<p className="text-sm font-semibold">-{stat.reduction}%</p>
														</div>
													))
												) : (
													<p className="text-muted-foreground col-span-full text-xs">
														Run your first pass to view measured impact here.
													</p>
												)}
											</div>
										</div>
									</AccordionContent>
								</AccordionItem>

								<AccordionItem value="advanced" className="rounded-2xl border px-4">
									<AccordionTrigger className="py-3">
										<div className="text-left">
											<p className="text-sm font-semibold">Advanced controls</p>
											<p className="text-muted-foreground text-xs">
												Optional detailed tuning.
											</p>
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
					</div>

					<DialogFooter className="bg-background shrink-0 border-t px-6 py-4">
						{!isBlockingClose && (
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Close
							</Button>
						)}
						<div className="w-full sm:w-[18rem]">
							<OptimizeButton
								onOptimize={runOptimization}
								isPending={isPending}
								hasOptimized={hasImproved}
								isPreparing={isOptimizerPreparing}
								fixedBottom={false}
							/>
						</div>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default OptimizationModal
