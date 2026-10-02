import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import { resolveSimplificationOutcome } from './model/simplification-outcome'
import { runOptimizationPass } from './run-optimization-pass'
import { useLatestWins } from './use-latest-wins'
import { useOptimizationSteps } from './use-optimization-steps'
import { useSceneSizeCalculator } from './utils'
import {
	resolveDerivedSettings,
	resolveSceneMetrics
} from '../../../lib/domain/scene'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'

import type { Optimizations } from '@vctrl/core'

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
/** A choice of settings, bound to the source it was made for. */
interface DeriveRequest {
	settings: Optimizations
	source: Uint8Array | null
}

export const useOptimizationProcess = () => {
	const { optimizer, file } = useModelContext(true)
	const {
		isReady,
		isPreparing,
		texturesOptimization,
		applyOptimization,
		restoreSource,
		getSource,
		loadFromGlbBuffer,
		getModel,
		info,
		report
	} = optimizer

	const { optimizations: plannedOptimizations } = useAtomValue(optimizationAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
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
			report?.stats.textureBytes.after,
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

	/**
	 * Makes the document `source` plus `settings`, in one pass, as long as
	 * `source` is still the optimizer's source. A new load replaces the source,
	 * so a choice made for the previous scene, or a pass that settles after the
	 * scene changed, never describes the scene that replaced it.
	 */
	const derivePass = useCallback(
		async ({ settings, source }: DeriveRequest): Promise<void> => {
			if (isPreparing || !isReady || getSource() !== source) return

			const result = await runOptimizationPass({
				optimizations: settings,
				isCurrent: () => getSource() === source,
				steps: stepsController,
				model: {
					restoreSource,
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
					reportTextureBytesBefore: report?.stats.textureBytes.before,
					calculateSceneBytes
				},
				setRuntime: setOptimizationRuntime
			})

			if (getSource() !== source) return

			// A failed pass puts the source back on screen, so the source is what
			// describes the document then.
			setOptimizationState((prev) => ({
				...prev,
				derivedFrom: result.succeeded
					? resolveDerivedSettings(settings, prev.sourceSettings)
					: prev.sourceSettings
			}))
			void refreshOptimizedSizeInfo(result.dracoReport)
		},
		[
			isPreparing,
			isReady,
			getSource,
			stepsController,
			restoreSource,
			loadFromGlbBuffer,
			getModel,
			texturesOptimization,
			applyOptimization,
			clientSceneBytes,
			clientTextureBytes,
			file?.sourcePackageBytes,
			file?.sourceTextureBytes,
			latestSceneStats?.currentSceneBytes,
			report?.stats.textureBytes.before,
			calculateSceneBytes,
			setOptimizationRuntime,
			setOptimizationState,
			refreshOptimizedSizeInfo
		]
	)

	// Choosing presets faster than a pass runs derives the last one once more,
	// never each one in between.
	const deriveLatest = useLatestWins(derivePass)

	/** Makes the document the current source plus `settings`. */
	const derive = useCallback(
		(settings: Optimizations) =>
			deriveLatest({ settings, source: getSource() }),
		[deriveLatest, getSource]
	)

	/** Applies what the panel shows, for edits made in the advanced controls. */
	const applyPlanned = useCallback(
		() => derive(plannedOptimizations),
		[derive, plannedOptimizations]
	)

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

	// Keyed on what the displayed run actually did, not on the settings currently
	// staged for the next one. `plannedOptimizations` is the live atom the preset
	// cards and the advanced panel write, and the results panel renders beside
	// both, so gating on it made an already-finished result restate itself: flip
	// mesh reduction on and an untouched triangle count started reading as a
	// failed reduction, pick a preset after a simplifying pass and the reduction
	// that just happened disappeared. The persisted stats carry the answer for a
	// reopened scene, whose in-memory report has no applied steps of its own.
	const didSimplify =
		(report?.appliedOptimizations?.includes('simplification') ?? false) ||
		(latestSceneStats?.appliedOptimizations?.includes('simplification') ??
			false)

	// Measured, not projected. The ratio is still read from the live settings as
	// the "requested" figure to compare against.
	const simplificationOutcome = useMemo(
		() =>
			didSimplify
				? resolveSimplificationOutcome(
						report,
						plannedOptimizations.simplification?.ratio
					)
				: null,
		[report, didSimplify, plannedOptimizations.simplification]
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
		derive,
		applyPlanned
	}
}
