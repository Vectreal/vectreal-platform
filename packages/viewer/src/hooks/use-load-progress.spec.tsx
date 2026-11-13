// @vitest-environment jsdom
/**
 * Where the viewer's load is, and what its host is told about it.
 *
 * Mutation gates, executed:
 *  - return the host's progress after the model arrived and the preparing
 *    test goes red;
 *  - drop the phase comparison from the throttle and the phase-change test
 *    goes red;
 *  - key `model_loaded` on nothing and the once-per-model test goes red;
 *  - drop the once-guards and the StrictMode tests go red;
 *  - drop the trailing send and the newest-value test goes red;
 *  - send nothing held back on a phase change and the held-back test goes red;
 *  - keep the announced identity when the model goes and the comes-back test
 *    goes red.
 */
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

	it("is the viewer's own preparing once the model is here, with no count", () => {
		const { result } = renderHook(() =>
			useViewerLoadProgress({
				hasContent: true,
				isLoading: true,
				hostProgress: { phase: 'parsing' }
			})
		)
		expect(result.current).toEqual({ phase: 'preparing' })
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

const PARSING: LoadProgress = { phase: 'parsing' }

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

		// The held-back fetching value goes out before parsing starts.
		expect(emit.mock.calls.map(([event]) => event.progress.phase)).toEqual([
			'fetching',
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

	it('sends a held-back value before the next phase, and when the load ends', () => {
		vi.useFakeTimers()
		const emit = vi.fn()
		const { rerender } = renderHook(
			({ progress }) => useLoadEvents({ progress, modelIdentity: null, emit }),
			{
				initialProps: {
					progress: {
						phase: 'fetching',
						bytes: { loaded: 4, total: 10 }
					} as LoadProgress | null
				}
			}
		)
		rerender({
			progress: { phase: 'fetching', bytes: { loaded: 10, total: 10 } }
		})
		rerender({
			progress: { phase: 'preparing', items: { loaded: 2, total: 3 } }
		})
		rerender({
			progress: { phase: 'preparing', items: { loaded: 3, total: 3 } }
		})
		rerender({ progress: null })

		expect(
			emit.mock.calls.map(([event]) =>
				JSON.stringify(event.progress.bytes ?? event.progress.items)
			)
		).toEqual([
			'{"loaded":4,"total":10}',
			'{"loaded":10,"total":10}',
			'{"loaded":2,"total":3}',
			'{"loaded":3,"total":3}'
		])
	})

	it('says model_loaded again when the same model comes back', () => {
		const emit = vi.fn()
		const { rerender } = renderHook(
			({ identity }) =>
				useLoadEvents({ progress: null, modelIdentity: identity, emit }),
			{ initialProps: { identity: 'scene-a' as string | null } }
		)
		rerender({ identity: null })
		rerender({ identity: 'scene-a' })
		expect(types(emit)).toEqual(['model_loaded', 'model_loaded'])
	})

	it('sends a phase once under StrictMode too', () => {
		vi.useFakeTimers()
		const emit = vi.fn()
		renderHook(
			() =>
				useLoadEvents({
					progress: PARSING,
					modelIdentity: null,
					emit
				}),
			{ wrapper: StrictMode }
		)
		act(() => vi.advanceTimersByTime(500))
		expect(emit).toHaveBeenCalledTimes(1)
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
