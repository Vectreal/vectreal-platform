// @vitest-environment jsdom
/**
 * Replacing the source must read as busy. A pass that started while a restored
 * draft's real original was still being adopted would restore the draft's
 * optimized document instead, and its result would describe the wrong source.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import useOptimizeModel from './use-optimize-model'

const pending = vi.hoisted(() => ({ finish: () => {}, reportFails: false }))

vi.mock('@vctrl/core/model-optimizer', () => ({
	SupersededError: class extends Error {},
	ModelOptimizer: class {
		hasModel = () => true
		document = {}
		reset = () => {}
		getReport = async () => {
			if (pending.reportFails) throw new Error('export failed')
			return {
				appliedOptimizations: [],
				optimizedSize: 0,
				stats: Object.fromEntries(
					[
						'verticesCount',
						'primitivesCount',
						'meshesCount',
						'texturesCount',
						'materialsCount'
					].map((key) => [key, { before: 0, after: 0 }])
				)
			}
		}
		setSource = () =>
			new Promise<void>((resolve) => {
				pending.finish = resolve
			})
	}
}))

describe('setSource', () => {
	it('is not ready until the new source is in place', async () => {
		const { result } = renderHook(() => useOptimizeModel())
		expect(result.current.isReady).toBe(true)

		let adopting: Promise<void> = Promise.resolve()
		act(() => {
			adopting = result.current.setSource(new Uint8Array([1]))
		})
		expect(result.current.isReady).toBe(false)

		await act(async () => {
			pending.finish()
			await adopting
		})
		expect(result.current.isReady).toBe(true)
	})

	// The source is stated by then; a caller reading the rejection as "not
	// stated" would relabel a source the optimizer does hold.
	it('resolves once the source is stated, even if the report fails', async () => {
		pending.reportFails = true
		const { result } = renderHook(() => useOptimizeModel())

		let stating: Promise<void> = Promise.resolve()
		act(() => {
			stating = result.current.setSource(new Uint8Array([1]))
		})
		await act(async () => {
			pending.finish()
			await expect(stating).resolves.toBeUndefined()
		})
		expect(result.current.error).toBeInstanceOf(Error)
		pending.reportFails = false
	})
})
