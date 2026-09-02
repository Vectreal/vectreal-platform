import {
	LOAD_GEOMETRY_STEP,
	planOptimizationSteps,
	PREPARE_STEP,
	SYNC_STEP
} from '.'
import { balancedPreset } from '../../../../constants/optimizations'

import type { Optimizations } from '@vctrl/core'

const enable = (
	base: Optimizations,
	keys: Array<keyof Optimizations>
): Optimizations => {
	const next = structuredClone(base)
	for (const key of Object.keys(next) as Array<keyof Optimizations>) {
		next[key] = { ...next[key], enabled: keys.includes(key) }
	}
	return next
}

describe('planOptimizationSteps', () => {
	it('always brackets the run with preparation and sync rows', () => {
		const { allSteps } = planOptimizationSteps(enable(balancedPreset, []))

		expect(allSteps).toEqual([PREPARE_STEP, SYNC_STEP])
	})

	it('lists geometry steps in worker execution order, not declaration order', () => {
		const { allSteps } = planOptimizationSteps(
			enable(balancedPreset, ['draco', 'simplification', 'quantize', 'dedup'])
		)

		expect(allSteps).toEqual([
			PREPARE_STEP,
			'Mesh simplification',
			'Duplicate removal',
			'Vertex quantization',
			'Draco compression',
			LOAD_GEOMETRY_STEP,
			SYNC_STEP
		])
	})

	it('puts texture optimization after geometry, where it actually runs', () => {
		const { allSteps, hasTextureStep } = planOptimizationSteps(
			enable(balancedPreset, ['texture', 'simplification'])
		)

		expect(hasTextureStep).toBe(true)
		// The worker reload sits between the two phases because that is when it
		// happens; borrowing the trailing sync row for it made the checklist jump
		// to the end and back once textures started.
		expect(allSteps).toEqual([
			PREPARE_STEP,
			'Mesh simplification',
			LOAD_GEOMETRY_STEP,
			'Texture optimization',
			SYNC_STEP
		])
	})

	it('omits the geometry reload row when no geometry step runs', () => {
		const { allSteps } = planOptimizationSteps(
			enable(balancedPreset, ['texture'])
		)

		expect(allSteps).toEqual([PREPARE_STEP, 'Texture optimization', SYNC_STEP])
	})

	it('labels an entry that carries no `name`', () => {
		// What settings persisted before Draco shipped look like once the toggle
		// is flipped: the spread has nothing to copy, so only `enabled` is set.
		const legacy = {
			...enable(balancedPreset, ['simplification']),
			draco: { enabled: true }
		} as unknown as Optimizations

		const { geometryKeys, allSteps } = planOptimizationSteps(legacy)

		expect(allSteps).toEqual([
			PREPARE_STEP,
			'Mesh simplification',
			'Draco compression',
			LOAD_GEOMETRY_STEP,
			SYNC_STEP
		])
		expect(
			allSteps.every((step) => typeof step === 'string' && step.length > 0)
		).toBe(true)
		// The same lookup drives the worker payload, so the step really runs.
		expect(geometryKeys).toContain('draco')
	})

	it('tolerates an optimizations object missing keys entirely', () => {
		const partial = {
			simplification: { enabled: true }
		} as unknown as Optimizations

		expect(planOptimizationSteps(partial).allSteps).toEqual([
			PREPARE_STEP,
			'Mesh simplification',
			LOAD_GEOMETRY_STEP,
			SYNC_STEP
		])
	})
})
