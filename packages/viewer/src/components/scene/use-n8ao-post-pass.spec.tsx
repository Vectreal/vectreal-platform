// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useN8AOPostPass } from './use-n8ao-post-pass'

import type { N8AOPostPassConstructor } from './n8ao'
import type { MockInstance } from 'vitest'

const Pass = class {} as unknown as N8AOPostPassConstructor

const load = vi.hoisted(() => vi.fn())
vi.mock('./n8ao', () => ({ loadN8AOPostPass: load }))

/** A fetch the test settles by hand. */
function pendingFetch() {
	let resolve!: (pass: N8AOPostPassConstructor) => void
	let reject!: (error: Error) => void
	load.mockReturnValueOnce(
		new Promise<N8AOPostPassConstructor>((res, rej) => {
			resolve = res
			reject = rej
		})
	)
	return { resolve, reject }
}

describe('useN8AOPostPass', () => {
	let consoleWarn: MockInstance<typeof console.warn>
	beforeEach(() => {
		load.mockReset()
		consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	})
	afterEach(() => {
		// A pass that fails to load says so, and nothing else warns.
		for (const [message] of consoleWarn.mock.calls) {
			expect(message).toBe('Ambient occlusion is unavailable:')
		}
	})

	it('fetches nothing and builds without AO while AO is off', () => {
		const { result } = renderHook(() => useN8AOPostPass(false))
		expect(result.current).toBeNull()
		expect(load).not.toHaveBeenCalled()
	})

	it('holds a viewer that opens with AO until the pass arrives', async () => {
		const fetch = pendingFetch()
		const { result } = renderHook(() => useN8AOPostPass(true))
		expect(result.current).toBeUndefined()

		await act(async () => fetch.resolve(Pass))
		expect(result.current).toBe(Pass)
	})

	it('keeps the current pipeline while AO turned on later downloads', async () => {
		const fetch = pendingFetch()
		const { result, rerender } = renderHook(({ ao }) => useN8AOPostPass(ao), {
			initialProps: { ao: false }
		})
		rerender({ ao: true })
		expect(result.current).toBeNull()

		await act(async () => fetch.resolve(Pass))
		expect(result.current).toBe(Pass)

		rerender({ ao: false })
		expect(result.current).toBeNull()
		rerender({ ao: true })
		expect(result.current).toBe(Pass)
		expect(load).toHaveBeenCalledTimes(1)
	})

	it('shows the scene without AO when the fetch fails, and retries next time', async () => {
		const failing = pendingFetch()
		const { result, rerender } = renderHook(({ ao }) => useN8AOPostPass(ao), {
			initialProps: { ao: true }
		})
		await act(async () => failing.reject(new Error('chunk failed')))
		expect(result.current).toBeNull()

		const retry = pendingFetch()
		rerender({ ao: false })
		rerender({ ao: true })
		await act(async () => retry.resolve(Pass))
		expect(result.current).toBe(Pass)
		expect(load).toHaveBeenCalledTimes(2)
	})
})
