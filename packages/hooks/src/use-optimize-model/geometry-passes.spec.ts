// @vitest-environment jsdom
/**
 * A geometry pass that fails says so. Each used to log the failure and
 * resolve, so `applyOptimization(simplifyOptimization)`, the pattern the
 * README shows, could never report one.
 */
import { renderHook } from '@testing-library/react'
import { ModelOptimizer } from '@vctrl/core/model-optimizer'
import { afterEach, describe, expect, it, vi } from 'vitest'

import useOptimizeModel from './use-optimize-model'

afterEach(() => {
	vi.restoreAllMocks()
})

const PASSES = [
	['simplifyOptimization', 'simplify'],
	['dedupOptimization', 'deduplicate'],
	['quantizeOptimization', 'quantize'],
	['normalsOptimization', 'optimizeNormals']
] as const

describe('useOptimizeModel geometry passes', () => {
	it.each(PASSES)('%s rejects with the error of %s', async (pass, method) => {
		const { result } = renderHook(() => useOptimizeModel())
		// After the render, which would otherwise read a document there is not.
		vi.spyOn(ModelOptimizer.prototype, 'hasModel').mockReturnValue(true)
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const error = new Error(`${method} failed`)
		vi.spyOn(ModelOptimizer.prototype, method).mockRejectedValue(error)

		await expect(result.current[pass]()).rejects.toBe(error)
	})

	it.each(PASSES)(
		'%s does nothing, and says nothing, before a model is loaded',
		async (pass, method) => {
			const run = vi.spyOn(ModelOptimizer.prototype, method)
			const { result } = renderHook(() => useOptimizeModel())

			await expect(result.current[pass]()).resolves.toBeUndefined()
			expect(run).not.toHaveBeenCalled()
		}
	)
})
