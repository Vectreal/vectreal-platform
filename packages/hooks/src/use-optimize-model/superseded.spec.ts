// @vitest-environment jsdom
/**
 * The geometry worker's output is a derivation of the loaded model, not a new
 * model, and an operation the core refused as stale must leave the busy state
 * to the newer load that superseded it.
 */
import { act, renderHook } from '@testing-library/react'
import { SupersededError } from '@vctrl/core/model-optimizer'
import { describe, expect, it, vi } from 'vitest'

import { reducer } from './state'
import useOptimizeModel from './use-optimize-model'

const calls = vi.hoisted(() => ({ load: vi.fn(), replace: vi.fn() }))

vi.mock('@vctrl/core/model-optimizer', () => ({
	SupersededError: class extends Error {},
	ModelOptimizer: class {
		hasModel = () => true
		reset = () => {}
		loadFromBuffer = calls.load
		replaceDocument = calls.replace
		setAppliedOptimizations = () => {}
		setDracoReport = () => {}
		getReport = async () => ({
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
		})
	}
}))

describe('useOptimizeModel worker sync', () => {
	// `replaceDocument` keeps the source and is refused by the core once
	// another model was loaded; a load would replace the source.
	it('syncs a derivation without loading a new model', async () => {
		const { result } = renderHook(() => useOptimizeModel())
		const derived = new Uint8Array([1])

		await act(() =>
			result.current.loadFromGlbBuffer(derived, undefined, {
				preserveBaseline: true
			})
		)

		expect(calls.replace).toHaveBeenCalledWith(derived)
		expect(calls.load).not.toHaveBeenCalled()
	})
})

describe('reducer', () => {
	it('leaves the state to the operation that superseded a stale one', () => {
		const busy = { error: null, loading: true, report: null }
		expect(
			reducer(busy, { type: 'LOAD_ERROR', payload: new SupersededError() })
		).toBe(busy)
	})

	it('reports a genuine failure', () => {
		const busy = { error: null, loading: true, report: null }
		const error = new Error('broken')
		expect(reducer(busy, { type: 'LOAD_ERROR', payload: error })).toEqual({
			...busy,
			loading: false,
			error
		})
	})
})
