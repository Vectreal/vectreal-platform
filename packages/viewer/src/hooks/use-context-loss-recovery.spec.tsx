// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CONTEXT_RESTORE_TIMEOUT_MS,
	REPEATED_CONTEXT_LOSS_WINDOW_MS,
	useContextLossRecovery
} from './use-context-loss-recovery'

/**
 * A phone that runs short of graphics memory takes the canvas's context away.
 * The viewer used to leave the canvas blank for good, with nothing on screen
 * or in any report saying why.
 */

function recovery() {
	const onEvent = vi.fn()
	const { result } = renderHook(() => useContextLossRecovery(onEvent))
	return { result, onEvent }
}

const lose = (onContextLost: (event: Event) => void) => {
	const event = new Event('webglcontextlost', { cancelable: true })
	act(() => onContextLost(event))
	return event
}

describe('useContextLossRecovery', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('keeps the context restorable, since a browser offers none back otherwise', () => {
		const { result, onEvent } = recovery()

		const event = lose(result.current.onContextLost)

		expect(event.defaultPrevented).toBe(true)
		expect(onEvent).toHaveBeenCalledWith({ type: 'context_lost' })
		expect(result.current.failed).toBe(false)
	})

	it('mounts a fresh canvas when the context comes back', () => {
		const { result, onEvent } = recovery()
		const before = result.current.canvasKey

		lose(result.current.onContextLost)
		act(() => result.current.onContextRestored())

		expect(result.current.canvasKey).not.toBe(before)
		expect(onEvent).toHaveBeenCalledWith({ type: 'context_restored' })
		// The restore cancelled the give-up.
		act(() => vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS))
		expect(result.current.failed).toBe(false)
	})

	it('gives up when the context is not back in time', () => {
		const { result, onEvent } = recovery()

		lose(result.current.onContextLost)
		act(() => vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS - 1))
		expect(result.current.failed).toBe(false)
		act(() => vi.advanceTimersByTime(1))

		expect(result.current.failed).toBe(true)
		expect(onEvent).toHaveBeenLastCalledWith({
			type: 'render_failed',
			reason: 'context_lost'
		})
	})

	it('gives up at once on a second loss soon after a restore', () => {
		const { result } = recovery()

		lose(result.current.onContextLost)
		act(() => result.current.onContextRestored())
		act(() => vi.advanceTimersByTime(REPEATED_CONTEXT_LOSS_WINDOW_MS - 1))
		lose(result.current.onContextLost)

		expect(result.current.failed).toBe(true)
	})

	it('waits for a restore again when the last loss is outside the window', () => {
		const { result } = recovery()

		lose(result.current.onContextLost)
		act(() => result.current.onContextRestored())
		act(() => vi.advanceTimersByTime(REPEATED_CONTEXT_LOSS_WINDOW_MS))
		lose(result.current.onContextLost)

		expect(result.current.failed).toBe(false)
	})

	it('drops a pending give-up when the canvas goes away for another reason', () => {
		// Scrolled out of view mid-wait: the restore can no longer be heard, and
		// the canvas mounted on the way back has a fresh context of its own.
		const { result, onEvent } = recovery()

		lose(result.current.onContextLost)
		act(() => result.current.onCanvasUnmount())
		act(() => vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS))

		expect(result.current.failed).toBe(false)
		expect(onEvent).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'render_failed' })
		)
	})

	it('starts over on a retry, with a fresh canvas and no memory of the losses', () => {
		const { result } = recovery()
		lose(result.current.onContextLost)
		act(() => vi.advanceTimersByTime(CONTEXT_RESTORE_TIMEOUT_MS))
		const failedKey = result.current.canvasKey

		act(() => result.current.retry())

		expect(result.current.failed).toBe(false)
		expect(result.current.canvasKey).not.toBe(failedKey)
		// A loss right after the retry waits for a restore rather than counting
		// as a repeat of the one that failed.
		lose(result.current.onContextLost)
		expect(result.current.failed).toBe(false)
	})
})
