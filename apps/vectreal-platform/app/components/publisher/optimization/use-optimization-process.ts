import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { resolveSimplificationOutcome } from './model/simplification-outcome'
import { runOptimizationPass } from './run-optimization-pass'
import { useLatestWins } from './use-latest-wins'
import { useOptimizationSteps } from './use-optimization-steps'
import { useSceneSizeCalculator } from './utils'
import { originalPreset } from '../../../constants/optimizations'
import {
	resolveDerivedSettings,
	resolveSceneMetrics
} from '../../../lib/domain/scene'
import {
	keptOriginalAtom,
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'

import type { SceneSourceRef } from '../../../types/api'
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
/** A choice of settings, bound to the scene it was made for. */
interface DeriveRequest {
	settings: Optimizations
	/**
	 * The load that put the scene on screen. Opening another scene starts a new
	 * load at once, while its source only replaces this one once it is ingested,
	 * and the new scene's state is hydrated in between.
	 */
	loadId: number | null
	/** Changes without a new load when a restored draft states its original. */
	source: Uint8Array | null
}

interface OptimizationProcessOptions {
	/** Whether the drawer is open, which is when a kept original loads. */
	isOpen: boolean
}

export const useOptimizationProcess = ({
	isOpen
}: OptimizationProcessOptions) => {
	const model = useModelContext(true)
	const { optimizer, file, isLatestLoad } = model
	const loadId = model.status === 'ready' ? model.loadId : null
	const {
		isReady,
		isPreparing,
		texturesOptimization,
		applyOptimization,
		restoreSource,
		getSource,
		setSource,
		loadFromGlbBuffer,
		getModel,
		info,
		report
	} = optimizer

	const { optimizations: plannedOptimizations } = useAtomValue(optimizationAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const store = useStore()
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
			report?.stats.textureBytes.after
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
	 * Makes the document `source` plus `settings`, in one pass, as long as the
	 * scene it was asked for is still open. A choice made for the previous scene,
	 * or a pass that settles after the scene changed, never describes the scene
	 * that replaced it.
	 */
	const derivePass = useCallback(
		async ({ settings, loadId, source }: DeriveRequest): Promise<void> => {
			const isCurrent = () =>
				loadId !== null && isLatestLoad(loadId) && getSource() === source
			if (isPreparing || !isReady || !isCurrent()) return

			// Every figure the pass records lands after an await, and the scene
			// it describes may have closed by then. The next scene's hydration
			// resets the runtime, so nothing is lost by dropping these.
			const writeRuntime: typeof setOptimizationRuntime = (update) => {
				if (isCurrent()) setOptimizationRuntime(update)
			}

			const result = await runOptimizationPass({
				optimizations: settings,
				isCurrent,
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
				setRuntime: writeRuntime
			})

			if (!isCurrent()) return

			// A failed pass puts the source back on screen, so the source is what
			// describes the document then.
			setOptimizationState((prev) => ({
				...prev,
				derivedFrom: result.succeeded
					? resolveDerivedSettings(settings, prev.sourceSettings)
					: prev.sourceSettings
			}))
			void refreshOptimizedSizeInfo(result.dracoReport, writeRuntime)
		},
		[
			isPreparing,
			isReady,
			isLatestLoad,
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

	/**
	 * A reopened scene's kept original becomes the source while the drawer is
	 * open, before any choice can be made: the drawer shows it loading in place
	 * of the presets until it has loaded or failed. It waits for the optimizer
	 * to be ready, since `setSource` cannot replace a document still being
	 * taken in. A failed download leaves passes on the saved version and is
	 * tried again the next time the drawer opens.
	 */
	const { stored, unreadable } = useAtomValue(keptOriginalAtom)
	const loadingOriginalRef = useRef<SceneSourceRef | null>(null)
	useEffect(() => {
		if (!isOpen) {
			if (unreadable) {
				store.set(keptOriginalAtom, (prev) => ({ ...prev, unreadable: false }))
			}
			return
		}
		if (!stored || unreadable || loadId === null) return
		if (isPreparing || !isReady) return
		// `setSource` itself re-renders the optimizer not ready, then ready.
		if (loadingOriginalRef.current === stored) return
		loadingOriginalRef.current = stored
		// Another scene, or the same one stated anew, may be loading by now;
		// only the load still in flight may state the source.
		const isOwner = () =>
			isLatestLoad(loadId) && loadingOriginalRef.current === stored

		void (async () => {
			try {
				const response = await fetch(stored.url)
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				const bytes = new Uint8Array(await response.arrayBuffer())
				if (!isOwner()) return
				await setSource(bytes)
				if (!isOwner()) return
				setOptimizationState((prev) => ({
					...prev,
					sourceSettings: originalPreset
				}))
				store.set(keptOriginalAtom, (prev) => ({ ...prev, stored: null }))
			} catch (error) {
				// The original stays stored, so a save keeps linking it.
				console.warn('[optimization] the kept original did not load', error)
				if (isOwner()) {
					store.set(keptOriginalAtom, (prev) => ({ ...prev, unreadable: true }))
				}
			} finally {
				if (loadingOriginalRef.current === stored) {
					loadingOriginalRef.current = null
				}
			}
		})()
	}, [
		isOpen,
		stored,
		unreadable,
		loadId,
		isPreparing,
		isReady,
		isLatestLoad,
		setSource,
		setOptimizationState,
		store
	])
	const isLoadingOriginal = isOpen && stored !== null && !unreadable

	/** Makes the document the current source plus `settings`. */
	const derive = useCallback(
		(settings: Optimizations) =>
			deriveLatest({ settings, loadId, source: getSource() }),
		[deriveLatest, loadId, getSource]
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
		isLoadingOriginal,
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
