import { applyOptimizationChange } from '../app/components/publisher/optimization/model/optimization-settings'
import {
	balancedPreset,
	optimizationPresets,
	qualityPreset,
	smallestPreset
} from '../app/constants/optimizations'
import { inferOptimizationPreset } from '../app/lib/domain/scene/client/optimization-inference'

import type { PresetId } from '../app/types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

describe('inferOptimizationPreset', () => {
	it('recognizes each preset', () => {
		for (const [id, preset] of Object.entries(optimizationPresets)) {
			expect(inferOptimizationPreset(preset)).toBe(id as PresetId)
		}
	})

	it('ignores a legacy `name` field left over from persisted rows', () => {
		const legacy = Object.fromEntries(
			Object.entries(balancedPreset).map(([key, value]) => [
				key,
				{ ...value, name: key }
			])
		) as unknown as Optimizations

		expect(inferOptimizationPreset(legacy)).toBe('balanced')
	})

	// The old implementation compared with JSON.stringify, so reordering keys
	// alone was enough to lose the match.
	it('is insensitive to key order', () => {
		const reordered = Object.fromEntries(
			Object.entries(qualityPreset).reverse()
		) as Optimizations

		expect(inferOptimizationPreset(reordered)).toBe('quality')
	})

	// Falling back to a preset here is what made the panel highlight a card that
	// no longer described the settings in effect.
	it('reports custom once a setting is edited', () => {
		const edited = applyOptimizationChange(smallestPreset, 'texture', {
			quality: 55
		})

		expect(inferOptimizationPreset(edited)).toBe('custom')
	})

	it('reports custom for an option the preset does not set', () => {
		const withExtra: Optimizations = {
			...balancedPreset,
			draco: { ...balancedPreset.draco, encodeSpeed: 3 }
		}

		expect(inferOptimizationPreset(withExtra)).toBe('custom')
	})

	// Scenes saved under the old pipeline had Draco off and simplification on.
	// They are preserved as-is rather than migrated, so they must read as custom.
	it('reports custom for settings saved under the old pipeline', () => {
		const legacy = {
			simplification: { name: 'simplification', enabled: true, ratio: 0.6, error: 0.005 },
			texture: {
				name: 'texture',
				enabled: true,
				resize: [1024, 1024],
				quality: 80,
				targetFormat: 'webp'
			},
			quantize: { name: 'quantize', enabled: true },
			dedup: { name: 'dedup', enabled: false },
			normals: { name: 'normals', enabled: false },
			draco: { name: 'draco', enabled: false, method: 'edgebreaker' }
		} as unknown as Optimizations

		expect(inferOptimizationPreset(legacy)).toBe('custom')
	})
})

describe('applyOptimizationChange', () => {
	it('turns quantization off when Draco is turned on', () => {
		const withQuantize: Optimizations = {
			...balancedPreset,
			quantize: { enabled: true },
			draco: { ...balancedPreset.draco, enabled: false }
		}

		const next = applyOptimizationChange(withQuantize, 'draco', {
			enabled: true
		})

		expect(next.draco.enabled).toBe(true)
		expect(next.quantize.enabled).toBe(false)
	})

	it('restores quantization when Draco is turned off', () => {
		const next = applyOptimizationChange(balancedPreset, 'draco', {
			enabled: false
		})

		expect(next.draco.enabled).toBe(false)
		expect(next.quantize.enabled).toBe(true)
	})

	it('leaves quantization alone when only Draco settings change', () => {
		const next = applyOptimizationChange(balancedPreset, 'draco', {
			method: 'sequential'
		})

		expect(next.quantize.enabled).toBe(balancedPreset.quantize.enabled)
		expect(next.draco.method).toBe('sequential')
	})

	it('does not mutate the settings it is given', () => {
		const snapshot = structuredClone(balancedPreset)
		applyOptimizationChange(balancedPreset, 'texture', { quality: 10 })

		expect(balancedPreset).toEqual(snapshot)
	})
})
