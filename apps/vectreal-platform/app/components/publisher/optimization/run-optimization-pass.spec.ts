import {
	SupersededError,
	TextureCompressionError
} from '@vctrl/core/model-optimizer'
import { toast } from 'sonner'
import { beforeEach, vi } from 'vitest'

import { LOAD_GEOMETRY_STEP, PREPARE_STEP, SYNC_STEP } from './model'
import { runOptimizationPass } from './run-optimization-pass'
import { balancedPreset } from '../../../constants/optimizations'

import type { OptimizationPassDeps } from './run-optimization-pass'
import type { SceneOptimizationRuntimeState } from '../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

const { runGeometryOptimizationsInWorker } = vi.hoisted(() => ({
	runGeometryOptimizationsInWorker: vi.fn()
}))

vi.mock('./utils/geometry-worker', () => ({
	OPTIMIZATION_STEP_TIMEOUT_MS: 90_000,
	MODEL_SYNC_TIMEOUT_MS: 60_000,
	runGeometryOptimizationsInWorker
}))

vi.mock('sonner', () => ({
	toast: {
		info: vi.fn(),
		warning: vi.fn(),
		error: vi.fn(),
		success: vi.fn()
	}
}))

const onlyEnable = (keys: Array<keyof Optimizations>): Optimizations => {
	const next = structuredClone(balancedPreset)
	for (const key of Object.keys(next) as Array<keyof Optimizations>) {
		next[key] = { ...next[key], enabled: keys.includes(key) }
	}
	return next
}

/** Records which model operations ran, in order. */
const callOrder: string[] = []
const recorded =
	<T>(name: string, value: T) =>
	async () => {
		callOrder.push(name)
		return value
	}

/** Records the checklist calls in order so sequencing can be asserted. */
function createStepsSpy() {
	const calls: string[] = []
	return {
		calls,
		controller: {
			plan: (allSteps: string[], first: string) =>
				calls.push(`plan:${allSteps.join('|')}`, `begin:${first}`),
			begin: (step: string) => calls.push(`begin:${step}`),
			complete: (step: string) => calls.push(`complete:${step}`),
			settleAll: () => calls.push('settleAll'),
			reset: () => calls.push('reset')
		}
	}
}

function createDeps(
	optimizations: Optimizations,
	overrides: Partial<OptimizationPassDeps['model']> = {},
	baselineOverrides: Partial<OptimizationPassDeps['baseline']> = {}
) {
	const steps = createStepsSpy()
	const runtime: SceneOptimizationRuntimeState[] = []
	let state = {} as SceneOptimizationRuntimeState
	// Stands in for derivePass dropping a superseded pass's writes.
	const filtered = { dropWrites: false }

	const model = {
		restoreSource: vi.fn(recorded('restoreSource', undefined)),
		loadFromGlbBuffer: vi.fn(recorded('loadFromGlbBuffer', undefined)),
		getModel: vi.fn(recorded('getModel', new Uint8Array([1, 2, 3]))),
		texturesOptimization: vi.fn(recorded('texturesOptimization', undefined)),
		applyOptimization: vi.fn(recorded('applyOptimization', undefined)),
		...overrides
	} satisfies OptimizationPassDeps['model']

	const deps: OptimizationPassDeps = {
		optimizations,
		isCurrent: () => true,
		steps: steps.controller,
		model,
		baseline: {
			// Already known, so the pass never has to measure.
			clientSceneBytes: 1_000,
			clientTextureBytes: 500,
			sourcePackageBytes: null,
			sourceTextureBytes: null,
			statsSceneBytes: null,
			reportTextureBytesBefore: null,
			calculateSceneBytes: vi.fn().mockResolvedValue(1_000),
			...baselineOverrides
		},
		setRuntime: (updater) => {
			if (filtered.dropWrites) return
			state = updater(state)
			runtime.push(state)
		},
		setRuntimeUnfiltered: (updater) => {
			state = updater(state)
			runtime.push(state)
		}
	}

	return { deps, steps, model, runtime, filtered }
}

beforeEach(() => {
	vi.clearAllMocks()
	callOrder.length = 0
	runGeometryOptimizationsInWorker.mockResolvedValue({
		buffer: new Uint8Array([9]),
		appliedOptimizations: ['deduplication'],
		dracoReport: undefined
	})
})

describe('runOptimizationPass', () => {
	it('plans the whole checklist before the first slow step', async () => {
		const { deps, steps } = createDeps(onlyEnable(['dedup', 'texture']))

		await runOptimizationPass(deps)

		expect(steps.calls[0]).toBe(
			`plan:${[
				PREPARE_STEP,
				'Duplicate removal',
				LOAD_GEOMETRY_STEP,
				'Texture optimization',
				SYNC_STEP
			].join('|')}`
		)
		expect(steps.calls[1]).toBe(`begin:${PREPARE_STEP}`)
	})

	it('runs geometry in the worker and syncs the result back', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup']))

		const result = await runOptimizationPass(deps)

		expect(runGeometryOptimizationsInWorker).toHaveBeenCalledOnce()
		expect(model.loadFromGlbBuffer).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			{ appliedOptimizations: ['deduplication'], dracoReport: undefined },
			// This is a sync of the worker's output, not a load of a new model, so
			// the optimizer must keep the baseline it captured from the pristine
			// upload. Re-deriving it from this already-optimized buffer would make
			// every `before` in the report equal its `after`.
			{ preserveBaseline: true }
		)
		expect(model.applyOptimization).toHaveBeenCalledOnce()
		expect(result.succeeded).toBe(true)
	})

	it('skips the worker entirely when only textures are enabled', async () => {
		const { deps, model } = createDeps(onlyEnable(['texture']))

		const result = await runOptimizationPass(deps)

		expect(runGeometryOptimizationsInWorker).not.toHaveBeenCalled()
		expect(model.texturesOptimization).toHaveBeenCalledOnce()
		expect(result.succeeded).toBe(true)
	})

	// Whichever phase runs first has to close out preparation, or the row spins
	// for the rest of the pass.
	it('completes the preparation step in either phase', async () => {
		for (const keys of [['dedup'], ['texture']] as Array<
			Array<keyof Optimizations>
		>) {
			const { deps, steps } = createDeps(onlyEnable(keys))
			await runOptimizationPass(deps)

			expect(steps.calls).toContain(`complete:${PREPARE_STEP}`)
		}
	})

	it('settles every row and clears the checklist when it finishes', async () => {
		const { deps, steps } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(steps.calls.at(-2)).toBe('settleAll')
		expect(steps.calls.at(-1)).toBe('reset')
	})

	// Every result is the original plus this pass's settings, so nothing may
	// touch the document before the original is back.
	it('restores the original before any step runs', async () => {
		const { deps } = createDeps(onlyEnable(['dedup', 'texture']))

		await runOptimizationPass(deps)

		expect(callOrder[0]).toBe('restoreSource')
		expect(callOrder.filter((call) => call === 'restoreSource')).toHaveLength(1)
	})

	// The restore replaced the document, so the viewer must catch up even when
	// the settings run nothing, which is how a user gets back to the original.
	it('syncs the viewer when no step is enabled', async () => {
		const { deps, model } = createDeps(onlyEnable([]))

		const result = await runOptimizationPass(deps)

		expect(model.restoreSource).toHaveBeenCalledOnce()
		expect(model.applyOptimization).toHaveBeenCalledOnce()
		expect(result.succeeded).toBe(true)
	})

	it('optimizes anyway when the baseline size cannot be measured', async () => {
		// The baseline is the display-only "before" column, and measuring it means
		// exporting the whole document — slowest on the models that most need the
		// pass. A failure there must not refuse the optimization.
		const { deps, model, runtime } = createDeps(
			onlyEnable(['dedup']),
			{},
			{
				clientSceneBytes: null,
				calculateSceneBytes: vi
					.fn()
					.mockRejectedValue(
						new Error('Baseline scene size calculation timed out')
					)
			}
		)

		const result = await runOptimizationPass(deps)

		expect(result.succeeded).toBe(true)
		expect(model.applyOptimization).toHaveBeenCalled()
		// The spinner stops even though the number never arrived.
		expect(runtime.some((state) => state.isSceneSizeLoading === false)).toBe(
			true
		)
	})

	it('carries the Draco measurement out of the worker', async () => {
		const dracoReport = {
			geometryBytesBefore: 1_000,
			geometryBytesAfterCompression: 200,
			reductionPercent: 80,
			projectedGlbBytes: 400,
			uncompressedGlbBytes: 1_200,
			isWorthApplying: true
		}
		runGeometryOptimizationsInWorker.mockResolvedValue({
			buffer: new Uint8Array([9]),
			appliedOptimizations: [],
			dracoReport
		})
		const { deps } = createDeps(onlyEnable(['draco']))

		const result = await runOptimizationPass(deps)

		expect(result.dracoReport).toEqual(dracoReport)
	})

	// A stale report would keep advertising a saving that this pass never
	// made, and the last publish describes the document this pass replaces.
	it('clears the previous Draco report and publish record before running', async () => {
		const { deps, runtime } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(runtime[0]).toMatchObject({
			isPending: true,
			dracoReport: null,
			publishedEncoding: null,
			passRevision: expect.any(Number)
		})
	})

	// A revision after a runtime reset must never equal one handed out before.
	it('gives every pass a revision no other pass has had', async () => {
		const first = createDeps(onlyEnable(['dedup']))
		const second = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(first.deps)
		await runOptimizationPass(second.deps)

		expect(second.runtime[0].passRevision).toBeGreaterThan(
			first.runtime[0].passRevision
		)
	})

	it('reports failure and clears the checklist when a step throws', async () => {
		runGeometryOptimizationsInWorker.mockRejectedValue(new Error('boom'))
		const { deps, steps } = createDeps(onlyEnable(['dedup']))

		const result = await runOptimizationPass(deps)

		expect(result).toEqual({ succeeded: false, dracoReport: null })
		expect(steps.calls).toContain('reset')
		expect(steps.calls).not.toContain('settleAll')
	})

	// A failed pass leaves a partial document behind, and a save exports the
	// document, so the original goes back on screen instead.
	it('shows the original after a failure', async () => {
		runGeometryOptimizationsInWorker.mockRejectedValue(new Error('boom'))
		const { deps } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(callOrder.slice(-2)).toEqual(['restoreSource', 'applyOptimization'])
	})

	it('always clears the pending flag, including on failure', async () => {
		runGeometryOptimizationsInWorker.mockRejectedValue(new Error('boom'))
		const { deps, runtime } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(runtime.at(-1)).toMatchObject({ isPending: false })
	})

	// A superseded pass's writes are dropped, and when no hydration follows,
	// as after setSource, nothing else would lower the flag it raised.
	it('clears its pending flag even once its other writes are dropped', async () => {
		const { deps, runtime, filtered } = createDeps(onlyEnable(['dedup']))
		runGeometryOptimizationsInWorker.mockImplementation(async () => {
			filtered.dropWrites = true
			throw new Error('superseded')
		})

		await runOptimizationPass(deps)

		expect(runtime.at(-1)).toMatchObject({ isPending: false })
	})

	it('leaves the flag of a newer pass alone', async () => {
		const { deps, runtime } = createDeps(onlyEnable(['dedup']))
		runGeometryOptimizationsInWorker.mockImplementation(async () => {
			deps.setRuntimeUnfiltered((prev) => ({
				...prev,
				isPending: true,
				passRevision: prev.passRevision + 1000
			}))
			throw new Error('superseded')
		})

		await runOptimizationPass(deps)

		expect(runtime.at(-1)).toMatchObject({ isPending: true })
	})

	// Skipping the phase would leave a result these settings do not produce.
	it('fails when the model cannot be exported for the geometry steps', async () => {
		const { deps } = createDeps(onlyEnable(['dedup', 'texture']), {
			getModel: vi.fn().mockResolvedValue(null)
		})

		const result = await runOptimizationPass(deps)

		expect(result.succeeded).toBe(false)
		expect(callOrder).not.toContain('texturesOptimization')
	})

	it('fails when no texture could be compressed', async () => {
		const { deps } = createDeps(onlyEnable(['texture']), {
			texturesOptimization: vi
				.fn()
				.mockRejectedValue(new TextureCompressionError(9, 9, 'all failed'))
		})

		expect((await runOptimizationPass(deps)).succeeded).toBe(false)
	})

	// Some textures replaced and the rest left as uploaded is still a result
	// made from the original, so it stands.
	it('succeeds when only some textures could not be compressed', async () => {
		const { deps } = createDeps(onlyEnable(['texture']), {
			texturesOptimization: vi
				.fn()
				.mockRejectedValue(new TextureCompressionError(2, 9, 'two failed'))
		})

		expect((await runOptimizationPass(deps)).succeeded).toBe(true)
	})

	// The optimizer is shared: a pass that outlives its scene must leave the
	// next scene's document, viewer and baseline alone.
	it('stops before touching the optimizer once its scene is replaced', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup', 'texture']))
		runGeometryOptimizationsInWorker.mockImplementation(async () => {
			deps.isCurrent = () => false
			return {
				buffer: new Uint8Array([9]),
				appliedOptimizations: [],
				dracoReport: undefined
			}
		})

		const result = await runOptimizationPass(deps)

		expect(result.succeeded).toBe(false)
		expect(model.loadFromGlbBuffer).not.toHaveBeenCalled()
		expect(model.texturesOptimization).not.toHaveBeenCalled()
		expect(model.applyOptimization).not.toHaveBeenCalled()
		expect(model.restoreSource).toHaveBeenCalledOnce()
	})

	it('does not sync a texture result into a scene that replaced its own', async () => {
		const { deps, model } = createDeps(onlyEnable(['texture']), {
			texturesOptimization: vi.fn(async () => {
				deps.isCurrent = () => false
			})
		})

		const result = await runOptimizationPass(deps)

		expect(result.succeeded).toBe(false)
		expect(model.applyOptimization).not.toHaveBeenCalled()
	})

	it('does not compress textures for a scene that replaced its own', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup', 'texture']), {
			loadFromGlbBuffer: vi.fn(async () => {
				deps.isCurrent = () => false
			})
		})

		await runOptimizationPass(deps)

		expect(model.texturesOptimization).not.toHaveBeenCalled()
	})

	// Another caller can claim the optimizer without a load (a reset, or a
	// restore or replacement of its document); the pass hears of it only from
	// the core.
	it('stays silent when the optimizer refuses a stale commit', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup']), {
			loadFromGlbBuffer: vi.fn(async () => {
				throw new SupersededError()
			})
		})

		const result = await runOptimizationPass(deps)

		expect(result.succeeded).toBe(false)
		expect(toast.error).not.toHaveBeenCalled()
		expect(model.restoreSource).toHaveBeenCalledOnce()
	})
})
