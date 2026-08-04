import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import { resolveSimplificationOutcome } from './model/simplification-outcome'
import { runOptimizationPass } from './run-optimization-pass'
import { useOptimizationSteps } from './use-optimization-steps'
import { useSceneSizeCalculator } from './utils'
import { resolveSceneMetrics } from '../../../lib/domain/scene'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'

export type SizeInfo = {
	initialSceneBytes?: number | null
	currentSceneBytes?: number | null
	/** Uncompressed working-document size, when it differs from the published one. */
	workingSceneBytes?: number | null
	initialTextureBytes?: number | null
	currentTextureBytes?: number | null
	isSceneSizeComputing?: boolean
	isInitialMetricsHydrating?: boolean
}

/**
 * Wires the optimization pass to React state.
 *
 * The pass itself lives in `run-optimization-pass.ts` as a plain function; this
 * hook only assembles its dependencies and exposes the results the drawer
 * renders.
 */
export const useOptimizationProcess = () => {
	const { optimizer, file } = useModelContext(true)
	const {
		isReady,
		isPreparing,
		texturesOptimization,
		applyOptimization,
		reset,
		loadFromServerSceneData,
		loadFromGlbBuffer,
		getModel,
		info,
		report
	} = optimizer

	const { optimizations: plannedOptimizations } = useAtomValue(optimizationAtom)
	const [optimizationRuntime, setOptimizationRuntime] = useAtom(
		optimizationRuntimeAtom
	)
	const {
		isPending,
		optimizedSceneBytes,
		clientSceneBytes,
		workingSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes,
		latestSceneStats,
		dracoReport: runtimeDracoReport
	} = optimizationRuntime

	const { steps: optimizingStep, controller: stepsController } =
		useOptimizationSteps()

	const { calculateSceneBytes, refreshOptimizedSizeInfo } =
		useSceneSizeCalculator(
			optimizer,
			file ?? null,
			isReady,
			report?.stats.textures.after,
			setOptimizationRuntime
		)

	// `optimizedSceneBytes` only ever describes a pass run in this browser
	// session, and reopening a saved scene explicitly nulls it during hydration -
	// so on its own it answered "did you optimize in this tab" rather than "is
	// this scene optimized". `appliedOptimizations` is the persisted signal, and
	// it accrues only from real optimization operations (a publish-time Draco
	// repack never touches it), so a scene that was uploaded and published but
	// never optimized still reads as false.
	const hasCompletedOptimizationPass =
		typeof optimizationRuntime.optimizedSceneBytes === 'number' ||
		(latestSceneStats?.appliedOptimizations?.length ?? 0) > 0

	const runPass = useCallback(
		async (fromOriginal: boolean): Promise<boolean> => {
			if (isPending || isPreparing || !isReady) return false

			const { documentChanged, dracoReport } = await runOptimizationPass({
				fromOriginal,
				documentMayBeOptimized: hasCompletedOptimizationPass,
				optimizations: plannedOptimizations,
				steps: stepsController,
				model: {
					reset,
					loadFromServerSceneData,
					loadFromGlbBuffer,
					getModel,
					texturesOptimization,
					applyOptimization
				},
				baseline: {
					clientSceneBytes,
					clientTextureBytes,
					sourcePackageBytes: file?.sourcePackageBytes,
					sourceTextureBytes: file?.sourceTextureBytes,
					statsSceneBytes: latestSceneStats?.currentSceneBytes,
					reportTextureBytesBefore: report?.stats.textures.before,
					calculateSceneBytes
				},
				setRuntime: setOptimizationRuntime
			})

			if (documentChanged) {
				void refreshOptimizedSizeInfo(dracoReport)
			}

			return documentChanged
		},
		[
			isPending,
			isPreparing,
			isReady,
			hasCompletedOptimizationPass,
			plannedOptimizations,
			stepsController,
			reset,
			loadFromServerSceneData,
			loadFromGlbBuffer,
			getModel,
			texturesOptimization,
			applyOptimization,
			clientSceneBytes,
			clientTextureBytes,
			file?.sourcePackageBytes,
			file?.sourceTextureBytes,
			latestSceneStats?.currentSceneBytes,
			report?.stats.textures.before,
			calculateSceneBytes,
			setOptimizationRuntime,
			refreshOptimizedSizeInfo
		]
	)

	// Re-running a preset reloads the pristine scene first, so passes never
	// silently chain. "Optimize further" deliberately stacks on current state.
	const handleOptimizeClick = useCallback(() => runPass(true), [runPass])
	const handleStackOptimizeClick = useCallback(() => runPass(false), [runPass])

	const resolvedMetrics = useMemo(
		() =>
			resolveSceneMetrics({
				stats: latestSceneStats,
				report,
				info,
				runtime: {
					initialSceneBytes: clientSceneBytes,
					currentSceneBytes: optimizedSceneBytes,
					initialTextureBytes: clientTextureBytes,
					currentTextureBytes: optimizedTextureBytes,
					isSceneSizeComputing: optimizationRuntime.isSceneSizeLoading
				}
			}),
		[
			latestSceneStats,
			report,
			info,
			clientSceneBytes,
			optimizedSceneBytes,
			clientTextureBytes,
			optimizedTextureBytes,
			optimizationRuntime.isSceneSizeLoading
		]
	)

	const sizeInfo: SizeInfo = {
		initialSceneBytes: resolvedMetrics.sceneBytes.initial,
		currentSceneBytes: resolvedMetrics.sceneBytes.current,
		// Only meaningful when Draco is what makes the two diverge.
		workingSceneBytes:
			runtimeDracoReport?.isWorthApplying && workingSceneBytes != null
				? workingSceneBytes
				: null,
		initialTextureBytes: resolvedMetrics.textureBytes.initial,
		currentTextureBytes: resolvedMetrics.textureBytes.current,
		isSceneSizeComputing: resolvedMetrics.isSceneSizeComputing,
		isInitialMetricsHydrating: resolvedMetrics.isInitialMetricsHydrating
	}

	// Measured, not projected — and only when simplification was actually asked
	// for, since otherwise there is no target to compare against.
	const simplificationOutcome = useMemo(
		() =>
			plannedOptimizations.simplification?.enabled
				? resolveSimplificationOutcome(
						report,
						plannedOptimizations.simplification.ratio
					)
				: null,
		[report, plannedOptimizations.simplification]
	)

	return {
		info,
		report,
		// The runtime value alone, deliberately. A pass clears it up front and
		// sets it only if a geometry phase measured Draco, so it always describes
		// the latest run. Falling back to the optimizer's own `report.draco`
		// resurrected the previous measurement after a texture-only pass, which
		// also invalidates any projected size it was quoting.
		dracoReport: runtimeDracoReport ?? null,
		simplificationOutcome,
		resolvedMetrics,
		isPending,
		isOptimizerPreparing: isPreparing,
		isOptimizerReady: isReady,
		hasImproved: resolvedMetrics.hasImproved,
		hasCompletedOptimizationPass,
		sizeInfo,
		optimizingStep,
		handleOptimizeClick,
		handleStackOptimizeClick
	}
}
