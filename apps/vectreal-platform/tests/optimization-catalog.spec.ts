import {
	GEOMETRY_KEYS,
	OPTIMIZATION_CATALOG,
	OPTIMIZATION_KEYS,
	getOptimizationDefinition,
	listEnabledGeometryKeys,
	listEnabledKeys
} from '../app/components/publisher/optimization/model'
import { balancedPreset, optimizationPresets } from '../app/constants/optimizations'
import { GEOMETRY_STEP_ORDER } from '../app/workers/optimization.worker.types'

import type { Optimizations } from '@vctrl/core'

describe('optimization catalog', () => {
	it('describes every optimization exactly once', () => {
		const keys = Object.keys(balancedPreset) as Array<keyof Optimizations>

		expect([...OPTIMIZATION_KEYS].sort()).toEqual([...keys].sort())
		expect(new Set(OPTIMIZATION_KEYS).size).toBe(OPTIMIZATION_CATALOG.length)
	})

	// The worker iterates GEOMETRY_STEP_ORDER while the checklist is built from
	// the catalog. If they disagree the panel ticks rows in the wrong order.
	it('agrees with the order the worker actually runs steps in', () => {
		expect(GEOMETRY_KEYS).toEqual([...GEOMETRY_STEP_ORDER])
	})

	it('puts Draco last, after the steps that operate on decoded accessors', () => {
		expect(GEOMETRY_KEYS.at(-1)).toBe('draco')
	})

	it('gives every entry non-empty copy', () => {
		for (const definition of OPTIMIZATION_CATALOG) {
			expect(definition.stepLabel.length).toBeGreaterThan(0)
			expect(definition.title.length).toBeGreaterThan(0)
			expect(definition.description.length).toBeGreaterThan(0)
			expect(definition.tooltip.length).toBeGreaterThan(0)
		}
	})

	it('flags mesh simplification as the only destructive step', () => {
		const destructive = OPTIMIZATION_CATALOG.filter(
			(definition) => definition.isDestructive
		).map((definition) => definition.key)

		expect(destructive).toEqual(['simplification'])
	})

	it('keeps every destructive step out of every preset', () => {
		for (const preset of Object.values(optimizationPresets)) {
			for (const definition of OPTIMIZATION_CATALOG) {
				if (!definition.isDestructive) continue
				expect(preset[definition.key].enabled).toBe(false)
			}
		}
	})

	it('throws rather than silently rendering a blank row for an unknown key', () => {
		expect(() =>
			getOptimizationDefinition('nope' as keyof Optimizations)
		).toThrow(/No catalog entry/)
	})
})

describe('listEnabledKeys', () => {
	it('returns enabled keys in execution order, texture last', () => {
		expect(listEnabledKeys(balancedPreset)).toEqual([
			'dedup',
			'draco',
			'texture'
		])
	})

	it('excludes texture from the geometry list', () => {
		expect(listEnabledGeometryKeys(balancedPreset)).toEqual(['dedup', 'draco'])
	})

	it('treats a missing entry as disabled', () => {
		const partial = { draco: { enabled: true } } as unknown as Optimizations

		expect(listEnabledKeys(partial)).toEqual(['draco'])
	})
})

describe('presets', () => {
	// Draco is the largest saving available and does not change topology, so
	// there is no tier where leaving it off is the right default.
	it('enables Draco everywhere', () => {
		for (const preset of Object.values(optimizationPresets)) {
			expect(preset.draco.enabled).toBe(true)
		}
	})

	// Draco quantizes attributes itself; stacking the standalone pass on top
	// costs an extra pass and compounds precision loss.
	it('disables standalone quantization everywhere Draco is on', () => {
		for (const preset of Object.values(optimizationPresets)) {
			expect(preset.quantize.enabled).toBe(false)
		}
	})
})
