// @vitest-environment jsdom
/**
 * `useLoadProgress`: a loading state as the viewer's `loadProgress`.
 *
 * Mutation gate, executed: drop the `useMemo` and the identity test goes red.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLoadProgress } from './use-load-progress'

import type { ModelState } from './types'

const loading = (bytes: { loaded: number; total: number }): ModelState => ({
	status: 'loading',
	file: null,
	error: null,
	source: 'url',
	progress: 0,
	phase: 'fetching',
	bytes
})

describe('useLoadProgress', () => {
	it('reads a loading state, and nothing otherwise', () => {
		const bytes = { loaded: 1, total: 2 }
		expect(
			renderHook(() => useLoadProgress(loading(bytes))).result.current
		).toEqual({ phase: 'fetching', bytes, items: undefined })

		const empty: ModelState = {
			status: 'empty',
			file: null,
			error: null,
			source: null,
			progress: 0
		}
		expect(renderHook(() => useLoadProgress(empty)).result.current).toBeNull()
	})

	it('keeps its identity until the load moves', () => {
		const bytes = { loaded: 1, total: 2 }
		const { result, rerender } = renderHook(
			({ state }) => useLoadProgress(state),
			{ initialProps: { state: loading(bytes) } }
		)
		const first = result.current
		rerender({ state: loading(bytes) })
		expect(result.current).toBe(first)
	})
})
