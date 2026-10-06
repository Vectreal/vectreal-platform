import {
	SupersededError,
	TextureCompressionError
} from '@vctrl/core/model-optimizer'
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

import type { OptimizationStepsController } from './use-optimization-steps'
import type { GeometryOptimizationResult } from './utils'
import type { SceneOptimizationRuntimeState } from '../../../types/scene-optimization'
import type { DracoCompressionReport, Optimizations } from '@vctrl/core'

/**
 * Everything the pass touches, passed in rather than closed over.
 *
 * This used to be one `useCallback` with a twenty-entry dependency array, which
 * made it impossible to reason about when it was recreated and impossible to
 * exercise without mounting React. As a plain function it is neither.
 */
export interface OptimizationPassDeps {
	optimizations: Optimizations
	/**
	 * Whether the scene this pass started on is still loaded. The optimizer is
	 * shared and long-lived, so a pass that outlives its scene stops before its
	 * next change to it rather than writing its result into the next scene.
	 */
	isCurrent: () => boolean
	steps: OptimizationStepsController
	model: {
		/**
		 * Puts the original back as the working document. Every pass starts here,
		 * so its result is the original plus `optimizations` and nothing else.
		 */
		restoreSource: () => Promise<unknown>
		loadFromGlbBuffer: (
			buffer: Uint8Array,
			meta: {
				appliedOptimizations: string[]
				dracoReport?: DracoCompressionReport
			},
			options?: { preserveBaseline?: boolean }
		) => Promise<unknown>
		getModel: () => Promise<Uint8Array | null | undefined>
		texturesOptimization: (
			options: Optimizations['texture']
		) => Promise<unknown>
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
	/**
	 * Writes past whatever `setRuntime` filters out for a superseded pass. Only
	 * for lowering `isPending`: the pass that raised it must lower it, or
	 * nothing does when no hydration follows, as after `setSource`.
	 */
	setRuntimeUnfiltered: OptimizationPassDeps['setRuntime']
}

/**
 * Never reset, unlike the runtime: a revision handed out before a scene
 * switch must not equal one handed out after it.
 */
let lastPassRevision = 0

export interface OptimizationPassResult {
	/**
	 * Whether the document now is the original plus this pass's settings. False
	 * means the pass failed and the document is the original itself: a failed
	 * pass never leaves a partial result behind for the viewer or a save.
	 */
	succeeded: boolean
	/** Null unless Draco ran in this pass. Never carried over from a previous one. */
	dracoReport: DracoCompressionReport | null
}

/** Thrown at a checkpoint once the pass's scene has been replaced. */
class SupersededPass extends Error {}

/** Stops the pass before its next change to the optimizer if it is stale. */
const ensureCurrent = (deps: Pick<OptimizationPassDeps, 'isCurrent'>) => {
	if (!deps.isCurrent()) throw new SupersededPass()
}

const FAILED: OptimizationPassResult = {
	succeeded: false,
	dracoReport: null
}

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
			...(typeof sceneBytes === 'number'
				? { clientSceneBytes: sceneBytes }
				: {})
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

/** Runs the geometry steps in the worker and syncs the result back. */
async function runGeometryPhase(
	deps: OptimizationPassDeps,
	stepCount: number
): Promise<GeometryOptimizationResult> {
	const { steps, model, optimizations } = deps

	const currentBuffer = await withTimeout(
		model.getModel(),
		MODEL_SYNC_TIMEOUT_MS,
		'Model export for worker'
	)
	steps.complete(PREPARE_STEP)

	// Fails the pass rather than skipping the phase: a result without its
	// geometry steps would not be what these settings produce.
	if (!currentBuffer) {
		throw new Error(
			'Could not export the model for geometry optimization. Try reloading the scene.'
		)
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
	ensureCurrent(deps)
	steps.begin(LOAD_GEOMETRY_STEP)
	await withTimeout(
		model.loadFromGlbBuffer(
			result.buffer,
			{
				appliedOptimizations: result.appliedOptimizations,
				dracoReport: result.dracoReport
			},
			// A sync of the worker's output, not a load of a new model. Without
			// this the baseline is re-derived from the already-optimized buffer,
			// so every `before` in the report equals its `after` and the panel
			// claims mesh reduction achieved 0% however well it actually did.
			{ preserveBaseline: true }
		),
		MODEL_SYNC_TIMEOUT_MS,
		'Worker result sync'
	)
	steps.complete(LOAD_GEOMETRY_STEP)

	return result
}

/**
 * Compresses textures on the main thread, where the OffscreenCanvas encoder
 * lives. A partial failure still counts: some textures were replaced, and the
 * rest are the originals. A total failure throws, so the pass fails instead of
 * claiming texture settings that were never applied.
 */
async function runTexturePhase(deps: OptimizationPassDeps): Promise<void> {
	const { steps, model, optimizations } = deps
	const label = getOptimizationDefinition('texture').stepLabel

	// Only reached without the geometry phase when no geometry step is enabled,
	// in which case preparation ends here instead.
	steps.complete(PREPARE_STEP)
	ensureCurrent(deps)
	steps.begin(label)

	try {
		await withTimeout(
			model.texturesOptimization(optimizations.texture),
			OPTIMIZATION_STEP_TIMEOUT_MS,
			'Texture optimization'
		)
	} catch (error) {
		if (!(error instanceof TextureCompressionError && error.isPartial)) {
			throw error
		}
		console.warn('Some textures could not be compressed:', error)
	}
	steps.complete(label)
}

/** Shows the optimizer's document in the viewer, within the sync budget. */
const syncViewer = (model: OptimizationPassDeps['model']) =>
	withTimeout(model.applyOptimization(), MODEL_SYNC_TIMEOUT_MS, 'Model sync')

export async function runOptimizationPass(
	deps: OptimizationPassDeps
): Promise<OptimizationPassResult> {
	const { optimizations, steps, model, setRuntime } = deps
	const revision = ++lastPassRevision

	// Clear the previous pass's Draco measurement up front — this run may not
	// include Draco at all, and a stale report would keep advertising a saving
	// that no longer applies. The last publish goes too: it described the
	// document this pass is replacing.
	setRuntime((prev) => ({
		...prev,
		isPending: true,
		dracoReport: null,
		publishedEncoding: null,
		passRevision: revision
	}))

	const { geometryKeys, hasTextureStep, allSteps } =
		planOptimizationSteps(optimizations)

	// Set before the restore below, which is slow on large models and would
	// otherwise leave the panel spinning with no checklist at all.
	steps.plan(allSteps, PREPARE_STEP)

	let dracoReport: DracoCompressionReport | null = null

	try {
		await model.restoreSource()
		await establishBaselines(deps)

		if (geometryKeys.length > 0) {
			const result = await runGeometryPhase(deps, geometryKeys.length)
			dracoReport = result.dracoReport ?? null
			setRuntime((prev) => ({ ...prev, dracoReport }))

			if (dracoReport && !dracoReport.isWorthApplying) {
				toast.info(
					'Draco compression would not shrink this model, so it was skipped.'
				)
			}
		}

		if (hasTextureStep) {
			await runTexturePhase(deps)
		}

		// Always, even when every step was off or reverted: the restore above
		// replaced the document, so the viewer is showing a different one.
		ensureCurrent(deps)
		steps.begin(SYNC_STEP)
		await syncViewer(model)

		steps.settleAll()
	} catch (error) {
		// The scene it ran for is gone; the optimizer belongs to the next one.
		// A new load fails `isCurrent` at once. The core also refuses a stale
		// commit when another caller claims the optimizer without a load: a
		// reset, or a restore or replacement of its document.
		if (
			error instanceof SupersededError ||
			error instanceof SupersededPass ||
			!deps.isCurrent()
		) {
			return FAILED
		}

		console.error('Error during optimization:', error)
		toast.error(
			error instanceof Error
				? error.message
				: 'Optimization failed. Please retry.'
		)
		await showOriginal(model)
		return FAILED
	} finally {
		// Only while no newer pass has started: lowering its flag would read
		// as idle in the middle of its work.
		deps.setRuntimeUnfiltered((prev) =>
			prev.passRevision === revision ? { ...prev, isPending: false } : prev
		)
		steps.reset()
	}

	return { succeeded: true, dracoReport }
}

/**
 * After a failure the document holds a partial result the viewer is not
 * showing, and a save exports the document. Putting the original back and
 * showing it keeps the two the same, and the original is a state the user can
 * always start from again.
 */
async function showOriginal(model: OptimizationPassDeps['model']) {
	try {
		await model.restoreSource()
		await syncViewer(model)
	} catch (error) {
		console.error('Could not restore the original after a failure:', error)
	}
}
