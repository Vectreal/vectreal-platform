import { Button } from '@shared/components/ui/button'
import { formatFileSize } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { Eye, LoaderCircle, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState, type FC } from 'react'
import { Link } from 'react-router'

import { OptimizeButton } from './optimize-button'
import { AdvancedPanel } from './panels/advanced-panel'
import { PRESET_META, PresetPanel } from './panels/preset-panel'
import { OptimizationProgress } from './progress/optimization-progress'
import { OptimizationResults } from './results/optimization-results'
import { PreOptimizationSummary } from './results/pre-optimization-summary'
import { SceneNormalizationNotice } from './scene-normalization-notice'
import { COMPARE_HOLD_KEY, useHoldToCompare } from './use-hold-to-compare'
import { useOptimizationProcess } from './use-optimization-process'
import { useOptimizationSettings } from './use-optimization-settings'
import { DASHBOARD_ROUTES } from '../../../constants/dashboard'
import { originalPreset } from '../../../constants/optimizations'
import {
	canCompareWithSource,
	derivesFromSavedVersion,
	isSaveInFlight,
	optimizationsMatch,
	resolveDerivedSettings
} from '../../../lib/domain/scene'
import { savePanelAtom } from '../../../lib/stores/save-progress-store'
import {
	comparedModelAtom,
	keptOriginalAtom
} from '../../../lib/stores/scene-optimization-store'
import { PUBLISHER_LAYER } from '../shell/shell-layout'
import {
	DrillDown,
	DrillDownTrigger,
	DrillDownView
} from '../sidebars/drill-down'
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
	// Starts at the root each time the drawer opens.
	const [advancedPath, setAdvancedPath] = useState<string[]>([])
	useEffect(() => {
		if (!open) setAdvancedPath([])
	}, [open])

	const { optimizations, optimizationPreset, sourceSettings, derivedFrom } =
		useOptimizationSettings()
	const {
		info,
		dracoReport,
		simplificationOutcome,
		resolvedMetrics,
		sizeInfo,
		isPending,
		isLoadingOriginal,
		hasCompletedOptimizationPass,
		derive,
		applyPlanned,
		isOptimizerPreparing,
		optimizingStep
	} = useOptimizationProcess({ isOpen: open })

	// The document on screen is not what the panel shows: nothing has been
	// derived yet, or the advanced controls were edited since.
	const hasUnappliedSettings = !optimizationsMatch(
		resolveDerivedSettings(optimizations, sourceSettings),
		derivedFrom
	)
	const applyLabel =
		optimizationPreset === 'custom'
			? 'Apply changes'
			: `Apply ${PRESET_META[optimizationPreset].label}`

	const { stored, unreadable } = useAtomValue(keptOriginalAtom)
	const startsFromSavedVersion = derivesFromSavedVersion({
		stored,
		unreadable,
		sourceSettings
	})
	const isUnoptimized = optimizationsMatch(derivedFrom, originalPreset)

	const isSaving = isSaveInFlight(useAtomValue(savePanelAtom))
	const isComparable = canCompareWithSource({
		isOpen: open,
		isPending,
		isLoadingOriginal,
		isSaving,
		sourceSettings,
		derivedFrom
	})
	const sourceIsOriginal = optimizationsMatch(sourceSettings, originalPreset)
	const isComparing = useAtomValue(comparedModelAtom) !== null
	const sourceName = sourceIsOriginal ? 'the original' : 'the saved version'
	const { isPreparing: isPreparingCompare, holdProps } = useHoldToCompare({
		isOpen: open,
		isAvailable: isComparable,
		isOriginal: sourceIsOriginal
	})

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

		if (startsFromSavedVersion) {
			return 'Each preset is made from the saved version of this scene and applies as soon as you pick it. Save keeps the one you chose.'
		}
		return isUnoptimized
			? 'Not optimized yet. Picking a preset applies it from your original right away. Save keeps it.'
			: 'Each preset is made from your original and applies as soon as you pick it, so you can switch freely. Save keeps the one you chose.'
	}, [
		isUnoptimized,
		startsFromSavedVersion,
		isOverSizeLimit,
		maxSceneBytes,
		isPending,
		sizeInfo.currentSceneBytes
	])

	const resolvedDashboardHref = dashboardHref ?? DASHBOARD_ROUTES.DASHBOARD

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
				{/*
				  `pr-16` reserves the corner for the close button the drawer draws
				  itself. This header used to carry a second one: `showMobileHeader`
				  is false, so `DynamicSidebar` skips its `DrawerHeader` and this
				  panel draws its own - but `DrawerContent` still renders the built-in
				  close, so the sheet showed two X buttons a few pixels apart, both
				  gated on the same `closeDisabled`. The built-in stays because it is
				  the shared one and carries the sr-only "Close" the hand-rolled one
				  never had.
				*/}
				<div className="border-shell-border-soft shrink-0 border-b px-5 py-4 pr-16">
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
					</div>
				</div>

				<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
					<AnimatePresence mode="wait">
						{isPending ? (
							<OptimizationProgress key="processing" steps={optimizingStep} />
						) : isLoadingOriginal ? (
							<motion.div
								key="loading-original"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								role="status"
								className="flex items-center gap-3 px-5 py-6"
							>
								<LoaderCircle className="text-muted-foreground size-4 shrink-0 motion-safe:animate-spin" />
								<div className="space-y-0.5">
									<p className="text-sm font-medium">Loading your original</p>
									<p className="text-muted-foreground text-xs">
										Every preset is made from it, at full quality.
									</p>
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
								<DrillDown
									path={advancedPath}
									onPathChange={setAdvancedPath}
									rootTitle="Optimize Scene"
								>
									<DrillDownView id="root" className="space-y-3">
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

										{isComparable && (
											<Button
												type="button"
												variant="secondary"
												size="sm"
												className="w-full touch-none select-none"
												onContextMenu={(event) => event.preventDefault()}
												{...holdProps}
											>
												<Eye />
												{/* The canvas label sits behind the mobile sheet, so the
												    button says what is showing too. */}
												{isComparing
													? `Showing ${sourceName}`
													: isPreparingCompare
														? 'Preparing…'
														: `Hold to see ${sourceName}`}
												<kbd className="text-muted-foreground ml-auto font-mono text-[11px]">
													{COMPARE_HOLD_KEY}
												</kbd>
											</Button>
										)}

										<SceneNormalizationNotice />

										<PresetPanel
											onChoose={derive}
											sourceIsSaved={startsFromSavedVersion}
										/>

										<DrillDownTrigger
											to="advanced"
											icon={<SlidersHorizontal />}
											label="Advanced controls"
										/>
									</DrillDownView>

									<DrillDownView
										id="advanced"
										title="Advanced controls"
										caption="Fine-tune compression, textures and geometry."
									>
										<AdvancedPanel />
									</DrillDownView>
								</DrillDown>
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
						{hasUnappliedSettings || isPending ? (
							<OptimizeButton
								onOptimize={applyPlanned}
								isPending={isPending}
								label={applyLabel}
								isPreparing={isOptimizerPreparing}
								disabled={isLoadingOriginal}
							/>
						) : (
							// Over the limit, leaving points away from the only action that
							// unblocks saving, so it is not offered.
							!isOverSizeLimit && (
								<Button
									type="button"
									className="grow"
									onClick={() => onOpenChange(false)}
								>
									Continue to Composition
								</Button>
							)
						)}
					</div>
				</div>
			</div>
		</DynamicSidebar>
	)
}

export default OptimizationDrawer
