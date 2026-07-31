import { beforeEach, vi } from 'vitest'

import { runOptimizationPass } from '../app/components/publisher/optimization/run-optimization-pass'
import { PREPARE_STEP, SYNC_STEP } from '../app/components/publisher/optimization/model'
import { balancedPreset } from '../app/constants/optimizations'

import type { OptimizationPassDeps } from '../app/components/publisher/optimization/run-optimization-pass'
import type { SceneOptimizationRuntimeState } from '../app/types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

const { runGeometryOptimizationsInWorker } = vi.hoisted(() => ({
	runGeometryOptimizationsInWorker: vi.fn()
}))
const { loadOriginalSceneModel } = vi.hoisted(() => ({
	loadOriginalSceneModel: vi.fn()
}))

vi.mock(
	'../app/components/publisher/optimization/utils/geometry-worker',
	() => ({
		OPTIMIZATION_STEP_TIMEOUT_MS: 90_000,
		MODEL_SYNC_TIMEOUT_MS: 60_000,
		runGeometryOptimizationsInWorker
	})
)

vi.mock('../app/lib/persistence/pending-scene-idb', () => ({
	loadOriginalSceneModel
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
	overrides: Partial<OptimizationPassDeps['model']> = {}
) {
	const steps = createStepsSpy()
	const runtime: SceneOptimizationRuntimeState[] = []

	const model: OptimizationPassDeps['model'] = {
		reset: vi.fn(),
		loadFromServerSceneData: vi.fn().mockResolvedValue(undefined),
		loadFromGlbBuffer: vi.fn().mockResolvedValue(undefined),
		getModel: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
		texturesOptimization: vi.fn().mockResolvedValue(undefined),
		applyOptimization: vi.fn().mockResolvedValue(undefined),
		...overrides
	}

	const deps: OptimizationPassDeps = {
		fromOriginal: false,
		optimizations,
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
			calculateSceneBytes: vi.fn().mockResolvedValue(1_000)
		},
		setRuntime: (updater) => {
			const next = updater({} as SceneOptimizationRuntimeState)
			runtime.push(next)
		}
	}

	return { deps, steps, model, runtime }
}

beforeEach(() => {
	vi.clearAllMocks()
	runGeometryOptimizationsInWorker.mockResolvedValue({
		buffer: new Uint8Array([9]),
		appliedOptimizations: ['deduplication'],
		dracoReport: undefined
	})
	loadOriginalSceneModel.mockResolvedValue(null)
})

describe('runOptimizationPass', () => {
	it('plans the whole checklist before the first slow step', async () => {
		const { deps, steps } = createDeps(onlyEnable(['dedup', 'texture']))

		await runOptimizationPass(deps)

		expect(steps.calls[0]).toBe(
			`plan:${[PREPARE_STEP, 'Duplicate removal', 'Texture optimization', SYNC_STEP].join('|')}`
		)
		expect(steps.calls[1]).toBe(`begin:${PREPARE_STEP}`)
	})

	it('runs geometry in the worker and syncs the result back', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup']))

		const result = await runOptimizationPass(deps)

		expect(runGeometryOptimizationsInWorker).toHaveBeenCalledOnce()
		expect(model.loadFromGlbBuffer).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			{ appliedOptimizations: ['deduplication'], dracoReport: undefined }
		)
		expect(model.applyOptimization).toHaveBeenCalledOnce()
		expect(result.didApply).toBe(true)
	})

	it('skips the worker entirely when only textures are enabled', async () => {
		const { deps, model } = createDeps(onlyEnable(['texture']))

		const result = await runOptimizationPass(deps)

		expect(runGeometryOptimizationsInWorker).not.toHaveBeenCalled()
		expect(model.texturesOptimization).toHaveBeenCalledOnce()
		expect(result.didApply).toBe(true)
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

	it('reloads the pristine scene first when switching presets', async () => {
		loadOriginalSceneModel.mockResolvedValue({ sceneData: { scene: 1 } })
		const { deps, model } = createDeps(onlyEnable(['dedup']))
		deps.fromOriginal = true

		await runOptimizationPass(deps)

		expect(model.reset).toHaveBeenCalledOnce()
		expect(model.loadFromServerSceneData).toHaveBeenCalledWith({ scene: 1 })
	})

	it('optimizes from current state when stacking a pass', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(model.reset).not.toHaveBeenCalled()
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

	// A stale report would keep advertising a saving that this pass never made.
	it('clears the previous Draco report before running', async () => {
		const { deps, runtime } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(runtime[0]).toMatchObject({ isPending: true, dracoReport: null })
	})

	it('reports failure and clears the checklist when a step throws', async () => {
		runGeometryOptimizationsInWorker.mockRejectedValue(new Error('boom'))
		const { deps, steps } = createDeps(onlyEnable(['dedup']))

		const result = await runOptimizationPass(deps)

		expect(result).toEqual({ didApply: false, dracoReport: null })
		expect(steps.calls).toContain('reset')
		expect(steps.calls).not.toContain('settleAll')
	})

	it('always clears the pending flag, including on failure', async () => {
		runGeometryOptimizationsInWorker.mockRejectedValue(new Error('boom'))
		const { deps, runtime } = createDeps(onlyEnable(['dedup']))

		await runOptimizationPass(deps)

		expect(runtime.at(-1)).toMatchObject({ isPending: false })
	})

	// Nothing was optimized, so re-syncing the viewer would be pointless work.
	it('does not sync the viewer when the model could not be exported', async () => {
		const { deps, model } = createDeps(onlyEnable(['dedup']), {
			getModel: vi.fn().mockResolvedValue(null)
		})

		const result = await runOptimizationPass(deps)

		expect(result.didApply).toBe(false)
		expect(model.applyOptimization).not.toHaveBeenCalled()
	})
})
