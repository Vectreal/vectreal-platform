// @vitest-environment jsdom
/**
 * Where the viewer's load is, and what its host is told about it.
 *
 * The environment's files come from drei's `useProgress` store, set here
 * directly: under Vitest drei loads a different build of three than the
 * spec does, so driving the real `DefaultLoadingManager` would reach another
 * instance. In the browser bundle both are the same ESM module.
 *
 * Mutation gates, executed:
 *  - return the host's progress after the model arrived and the preparing
 *    test goes red;
 *  - drop the phase comparison from the throttle and the phase-change test
 *    goes red;
 *  - key `model_loaded` on nothing and the once-per-model test goes red;
 *  - drop the once-guard and the StrictMode test goes red;
 *  - drop the trailing send and the newest-value test goes red;
 *  - drop `state.active` from the selector and the finished-manager test goes red.
 */
import { useProgress } from '@react-three/drei'
import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useLoadEvents, useViewerLoadProgress } from './use-load-progress'

import type { ViewerInteractionEvent } from '../types/viewer-interactions'
import type { LoadProgress } from '@vctrl/core'

afterEach(() => {
	vi.useRealTimers()
})

describe('useViewerLoadProgress', () => {
	it("shows the host's load until the model arrives", () => {
		const host: LoadProgress = {
			phase: 'fetching',
			bytes: { loaded: 1, total: 2 }
		}
		const { result } = renderHook(() =>
			useViewerLoadProgress({
				hasContent: false,
				isLoading: true,
				hostProgress: host
			})
		)
		expect(result.current).toBe(host)
	})

	it("is the viewer's own preparing once the model is here, counting the environment", () => {
		const { result } = renderHook(() =>
			useViewerLoadProgress({
				hasContent: true,
				isLoading: true,
				hostProgress: { phase: 'parsing' }
			})
		)
		expect(result.current).toEqual({ phase: 'preparing' })

		act(() => useProgress.setState({ active: true, loaded: 1, total: 2 }))
		expect(result.current).toEqual({
			phase: 'preparing',
			items: { loaded: 1, total: 2 }
		})

		act(() => useProgress.setState({ active: false, loaded: 0, total: 0 }))
	})

	it("ignores counts drei's store kept from a load that finished", () => {
		act(() => useProgress.setState({ active: false, loaded: 5, total: 5 }))
		const { result } = renderHook(() =>
			useViewerLoadProgress({
				hasContent: true,
				isLoading: true,
				hostProgress: null
			})
		)
		expect(result.current).toEqual({ phase: 'preparing' })
		act(() => useProgress.setState({ loaded: 0, total: 0 }))
	})

	it('is nothing once the loader is gone', () => {
		const { result } = renderHook(() =>
			useViewerLoadProgress({
				hasContent: true,
				isLoading: false,
				hostProgress: { phase: 'parsing' }
			})
		)
		expect(result.current).toBeNull()
	})
})

describe('useLoadEvents', () => {
	const types = (emit: ReturnType<typeof vi.fn>) =>
		emit.mock.calls.map(([event]) => (event as ViewerInteractionEvent).type)

	it('tells the host every phase change, and a phase at most every 250 ms', () => {
		vi.useFakeTimers()
		const emit = vi.fn()
		const { rerender } = renderHook(
			({ progress }) => useLoadEvents({ progress, modelIdentity: null, emit }),
			{
				initialProps: {
					progress: {
						phase: 'fetching',
						bytes: { loaded: 1, total: 10 }
					} as LoadProgress
				}
			}
		)
		rerender({
			progress: { phase: 'fetching', bytes: { loaded: 2, total: 10 } }
		})
		rerender({ progress: { phase: 'parsing' } })
		vi.advanceTimersByTime(250)
		rerender({ progress: { phase: 'parsing', items: { loaded: 1, total: 3 } } })

		expect(emit.mock.calls.map(([event]) => event.progress.phase)).toEqual([
			'fetching',
			'parsing',
			'parsing'
		])
	})

	it('sends the newest value of a phase when the interval ends', () => {
		vi.useFakeTimers()
		const emit = vi.fn()
		const { rerender } = renderHook(
			({ progress }) => useLoadEvents({ progress, modelIdentity: null, emit }),
			{
				initialProps: {
					progress: {
						phase: 'fetching',
						bytes: { loaded: 1, total: 10 }
					} as LoadProgress
				}
			}
		)
		rerender({
			progress: { phase: 'fetching', bytes: { loaded: 4, total: 10 } }
		})
		rerender({
			progress: { phase: 'fetching', bytes: { loaded: 10, total: 10 } }
		})
		act(() => vi.advanceTimersByTime(250))

		expect(
			emit.mock.calls.map(([event]) => event.progress.bytes.loaded)
		).toEqual([1, 10])
	})

	it('says model_loaded once under StrictMode too', () => {
		const emit = vi.fn()
		renderHook(
			() => useLoadEvents({ progress: null, modelIdentity: 'model', emit }),
			{ wrapper: StrictMode }
		)
		expect(types(emit)).toEqual(['model_loaded'])
	})

	it('says model_loaded once per model', () => {
		const emit = vi.fn()
		const first = {}
		const { rerender } = renderHook(
			({ identity }) =>
				useLoadEvents({ progress: null, modelIdentity: identity, emit }),
			{ initialProps: { identity: null as object | null } }
		)
		rerender({ identity: first })
		rerender({ identity: first })
		rerender({ identity: {} })

		expect(types(emit)).toEqual(['model_loaded', 'model_loaded'])
	})
})
