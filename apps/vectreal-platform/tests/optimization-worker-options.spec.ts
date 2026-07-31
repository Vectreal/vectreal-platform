import { buildWorkerOptions } from '../app/components/publisher/optimization/model'
import { balancedPreset } from '../app/constants/optimizations'

import type { Optimizations } from '@vctrl/core'

describe('buildWorkerOptions', () => {
	it('includes only enabled geometry steps', () => {
		expect(Object.keys(buildWorkerOptions(balancedPreset))).toEqual([
			'dedup',
			'draco'
		])
	})

	// Texture compression needs OffscreenCanvas and runs on the main thread, so
	// sending it to the worker would silently do nothing.
	it('never sends the texture step to the worker', () => {
		expect(buildWorkerOptions(balancedPreset)).not.toHaveProperty('texture')
	})

	// `enabled` is UI state, not a glTF-Transform option. A key being present in
	// the payload already means the step should run.
	it('strips `enabled` and passes every other option through', () => {
		const optimizations: Optimizations = {
			...balancedPreset,
			simplification: { enabled: true, ratio: 0.5, error: 0.007 }
		}

		expect(buildWorkerOptions(optimizations).simplification).toEqual({
			ratio: 0.5,
			error: 0.007
		})
	})

	it('carries Draco settings across verbatim', () => {
		const optimizations: Optimizations = {
			...balancedPreset,
			draco: { enabled: true, method: 'sequential', quantizePosition: 12 }
		}

		expect(buildWorkerOptions(optimizations).draco).toEqual({
			method: 'sequential',
			quantizePosition: 12
		})
	})

	it('returns an empty payload when no geometry step is enabled', () => {
		const optimizations = Object.fromEntries(
			Object.entries(balancedPreset).map(([key, value]) => [
				key,
				{ ...value, enabled: false }
			])
		) as Optimizations

		expect(buildWorkerOptions(optimizations)).toEqual({})
	})
})
