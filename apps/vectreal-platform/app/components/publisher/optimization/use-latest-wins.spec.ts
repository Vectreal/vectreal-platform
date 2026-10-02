// @vitest-environment jsdom
/**
 * Picking presets faster than a pass runs must end on the last pick, and must
 * not run every pick in between: each one restores the original and
 * re-encodes every texture.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLatestWins } from './use-latest-wins'

function deferredRun() {
	const started: string[] = []
	const finishers: Array<() => void> = []
	const run = (input: string) => {
		started.push(input)
		return new Promise<void>((resolve) => finishers.push(resolve))
	}
	const finishNext = async () => {
		await act(async () => {
			finishers.shift()?.()
		})
	}
	return { run, started, finishNext }
}

describe('useLatestWins', () => {
	it('runs only the newest of the calls made during a run', async () => {
		const { run, started, finishNext } = deferredRun()
		const { result } = renderHook(() => useLatestWins(run))

		let first: Promise<void> = Promise.resolve()
		act(() => {
			first = result.current('smallest')
			void result.current('balanced')
			void result.current('quality')
		})
		await finishNext()
		await finishNext()
		await act(() => first)

		expect(started).toEqual(['smallest', 'quality'])
	})

	it('runs a later call normally once the queue has drained', async () => {
		const { run, started, finishNext } = deferredRun()
		const { result } = renderHook(() => useLatestWins(run))

		let pending: Promise<void> = Promise.resolve()
		act(() => {
			pending = result.current('smallest')
		})
		await finishNext()
		await act(() => pending)

		act(() => {
			pending = result.current('balanced')
		})
		await finishNext()
		await act(() => pending)

		expect(started).toEqual(['smallest', 'balanced'])
	})
})
