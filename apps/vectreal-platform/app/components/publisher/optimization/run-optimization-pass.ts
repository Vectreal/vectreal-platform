import { toast } from 'sonner'

import {
	buildWorkerOptions,
	getOptimizationDefinition,
	planOptimizationSteps,
	LOAD_GEOMETRY_STEP,
	PREPARE_STEP,
	SYNC_STEP
} from './model'
import {
	withTimeout,
	runGeometryOptimizationsInWorker,
	OPTIMIZATION_STEP_TIMEOUT_MS,
	MODEL_SYNC_TIMEOUT_MS
} from './utils'
import { loadOriginalSceneModel } from '../../../lib/persistence/pending-scene-idb'

import type { OptimizationStepsController } from './use-optimization-steps'
import type { GeometryOptimizationResult } from './utils'
import type { SceneOptimizationRuntimeState } from '../../../types/scene-optimization'
import type { DracoCompressionReport, Optimizations } from '@vctrl/core'
import type { ServerSceneData } from '@vctrl/core'

/**
 * Everything the pass touches, passed in rather than closed over.
 *
 * This used to be one `useCallback` with a twenty-entry dependency array, which
 * made it impossible to reason about when it was recreated and impossible to
 * exercise without mounting React. As a plain function it is neither.
 */
export interface OptimizationPassDeps {
	/**
	 * Reload the pristine scene from IndexedDB before optimizing. True when
	 * switching presets (so passes never silently chain), false when stacking
	 * another pass on the current state.
	 */
	fromOriginal: boolean
	optimizations: Optimizations
	steps: OptimizationStepsController
	model: {
		reset: () => void
		loadFromServerSceneData: (sceneData: ServerSceneData) => Promise<unknown>
		loadFromGlbBuffer: (
			buffer: Uint8Array,
			meta: {
				appliedOptimizations: string[]
				dracoReport?: DracoCompressionReport
			}
		) => Promise<unknown>
		getModel: () => Promise<Uint8Array | null | undefined>
		texturesOptimization: (options: Optimizations['texture']) => Promise<unknown>
		applyOptimization: () => Promise<unknown>
	}
	baseline: {
		/** Already-known sizes; each is only measured when still unknown. */
		clientSceneBytes: number | null
		clientTextureBytes: number | null
		sourcePackageBytes: number | null | undefined
		sourceTextureBytes: number | null | undefined
		statsSceneBytes: number | null | undefined
		reportTextureBytesBefore: number | null | undefined
		calculateSceneBytes: () => Promise<number | null>
	}
	setRuntime: (
		updater: (
			prev: SceneOptimizationRuntimeState
		) => SceneOptimizationRuntimeState
	) => void
}

export interface OptimizationPassResult {
	/** False when nothing ran, or the pass failed. */
	didApply: boolean
	/** Null unless Draco ran in this pass. Never carried over from a previous one. */
	dracoReport: DracoCompressionReport | null
}

const FAILED: OptimizationPassResult = { didApply: false, dracoReport: null }

/**
 * Measures the pre-optimization sizes that are not already known, so the
 * "before" column has something to show. Prefers figures that came with the
 * file or the server over exporting the document, which is slow.
 */
async function establishBaselines({
	baseline,
	setRuntime
}: Pick<OptimizationPassDeps, 'baseline' | 'setRuntime'>): Promise<void> {
	if (typeof baseline.clientSceneBytes !== 'number') {
		let sceneBytes: null | number = null

		if (typeof baseline.sourcePackageBytes === 'number') {
			sceneBytes = baseline.sourcePackageBytes
		} else if (typeof baseline.statsSceneBytes === 'number') {
			sceneBytes = baseline.statsSceneBytes
		} else {
			// Measuring means exporting the whole document, so this is the slow
			// path and likeliest to time out on exactly the large models the pass
			// matters most for. The result is the display-only "before" column:
			// worth an empty cell, never worth refusing to optimize.
			try {
				sceneBytes = await withTimeout(
					baseline.calculateSceneBytes(),
					MODEL_SYNC_TIMEOUT_MS,
					'Baseline scene size calculation'
				)
			} catch (error) {
				console.warn(
					'[optimization] Could not measure the baseline scene size:',
					error
				)
			}
		}

		// Cleared either way, so a failed measurement leaves the size blank
		// rather than spinning forever.
		setRuntime((prev) => ({
			...prev,
			isSceneSizeLoading: false,
			...(typeof sceneBytes === 'number' ? { clientSceneBytes: sceneBytes } : {})
		}))
	}

	if (typeof baseline.clientTextureBytes !== 'number') {
		const textureBytes =
			typeof baseline.sourceTextureBytes === 'number'
				? baseline.sourceTextureBytes
				: (baseline.reportTextureBytesBefore ?? null)

		if (typeof textureBytes === 'number') {
			setRuntime((prev) => ({ ...prev, clientTextureBytes: textureBytes }))
		}
	}
}

/**
 * Runs the geometry steps in the worker and syncs the result back.
 *
 * Returns null when the model could not be exported for the worker, which is
 * recoverable — the texture phase can still run.
 */
async function runGeometryPhase(
	deps: OptimizationPassDeps,
	stepCount: number
): Promise<GeometryOptimizationResult | null> {
	const { steps, model, optimizations } = deps

	const currentBuffer = await withTimeout(
		model.getModel(),
		MODEL_SYNC_TIMEOUT_MS,
		'Model export for worker'
	)
	steps.complete(PREPARE_STEP)

	if (!currentBuffer) {
		toast.warning(
			'Could not export the model for geometry optimization. Try reloading the scene.'
		)
		return null
	}

	let runningStep: string | null = null

	// The budget goes in rather than wrapping the call: only the worker helper
	// can terminate the Worker when it expires.
	const result = await runGeometryOptimizationsInWorker(
		currentBuffer,
		buildWorkerOptions(optimizations),
		(key, progress) => {
			const label = getOptimizationDefinition(key).stepLabel
			if (progress === 100) {
				runningStep = null
				steps.complete(label)
				return
			}
			// A step reports progress repeatedly while it runs; only the first
			// update needs to move the highlight.
			if (label !== runningStep) {
				runningStep = label
				steps.begin(label)
			}
		},
		OPTIMIZATION_STEP_TIMEOUT_MS * stepCount
	)

	if (runningStep) steps.complete(runningStep)

	// Its own row rather than borrowing SYNC_STEP, which is planned last: with
	// textures enabled that would jump the checklist to the end and then back
	// when the texture phase starts.
	steps.begin(LOAD_GEOMETRY_STEP)
	await withTimeout(
		model.loadFromGlbBuffer(result.buffer, {
			appliedOptimizations: result.appliedOptimizations,
			dracoReport: result.dracoReport
		}),
		MODEL_SYNC_TIMEOUT_MS,
		'Worker result sync'
	)

	return result
}

/**
 * Compresses textures on the main thread, where the OffscreenCanvas encoder
 * lives. A partial failure still counts as a pass: some textures were replaced.
 */
async function runTexturePhase(deps: OptimizationPassDeps): Promise<boolean> {
	const { steps, model, optimizations } = deps
	const label = getOptimizationDefinition('texture').stepLabel

	// Only reached without the geometry phase when no geometry step is enabled,
	// in which case preparation ends here instead.
	steps.complete(PREPARE_STEP)
	steps.begin(label)

	try {
		await withTimeout(
			model.texturesOptimization(optimizations.texture),
			OPTIMIZATION_STEP_TIMEOUT_MS,
			'Texture optimization'
		)
		steps.complete(label)
		return true
	} catch (error) {
		console.error('Error processing texture:', error)
		const isPartialFailure =
			error instanceof Error &&
			error.message.includes('failed for ') &&
			!error.message.includes('failed for all textures')

		if (isPartialFailure) {
			steps.complete(label)
			return true
		}
		return false
	}
}

export async function runOptimizationPass(
	deps: OptimizationPassDeps
): Promise<OptimizationPassResult> {
	const { fromOriginal, optimizations, steps, model, setRuntime } = deps

	// Clear the previous pass's Draco measurement up front — this run may not
	// include Draco at all, and a stale report would keep advertising a saving
	// that no longer applies.
	setRuntime((prev) => ({ ...prev, isPending: true, dracoReport: null }))

	const { geometryKeys, hasTextureStep, allSteps } =
		planOptimizationSteps(optimizations)

	// Set before the scene reload below, which is slow on large models and would
	// otherwise leave the panel spinning with no checklist at all.
	steps.plan(allSteps, PREPARE_STEP)

	let didApply = false
	let dracoReport: DracoCompressionReport | null = null

	try {
		if (fromOriginal) {
			const original = await loadOriginalSceneModel()
			if (original) {
				model.reset()
				await model.loadFromServerSceneData(original.sceneData)
			} else {
				console.warn(
					'[optimization] No original scene in IDB; optimizing from current document state.'
				)
			}
		}

		await establishBaselines(deps)

		if (geometryKeys.length > 0) {
			const result = await runGeometryPhase(deps, geometryKeys.length)

			if (result) {
				dracoReport = result.dracoReport ?? null
				setRuntime((prev) => ({ ...prev, dracoReport }))

				if (dracoReport && !dracoReport.isWorthApplying) {
					toast.info(
						'Draco compression would not shrink this model, so it was skipped.'
					)
				}

				didApply = true
			}
		}

		if (hasTextureStep) {
			didApply = (await runTexturePhase(deps)) || didApply
		}

		if (didApply) {
			steps.begin(SYNC_STEP)
			try {
				await withTimeout(
					model.applyOptimization(),
					MODEL_SYNC_TIMEOUT_MS,
					'Model sync'
				)
			} catch (syncError) {
				console.warn('Model sync after optimization failed:', syncError)
			}
		}

		steps.settleAll()
	} catch (error) {
		console.error('Error during optimization:', error)
		toast.error(
			error instanceof Error
				? error.message
				: 'Optimization failed. Please retry.'
		)
		return FAILED
	} finally {
		setRuntime((prev) => ({ ...prev, isPending: false }))
		steps.reset()
	}

	return { didApply, dracoReport }
}
