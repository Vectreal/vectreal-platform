import { afterEach, describe, expect, it, vi } from 'vitest'

import { planFirstOpenFill, waitForSettledBake } from './first-open-fill'

const bake = { dataUrl: 'data:image/png;base64,AA==', signature: 'v2:1' }

describe('planFirstOpenFill', () => {
	it('asks for a thumbnail when none is stored, and for a bake only with shadows on and none stored', () => {
		expect(planFirstOpenFill({ thumbnailUrl: '' })).toEqual({
			thumbnail: true,
			bake: false
		})
		expect(
			planFirstOpenFill({
				thumbnailUrl: '/api/scenes/s1/thumbnail/a1',
				shadows: { enabled: true }
			})
		).toEqual({ thumbnail: false, bake: true })
		expect(
			planFirstOpenFill({
				thumbnailUrl: '/api/scenes/s1/thumbnail/a1',
				shadows: { enabled: true, baked: { assetId: 'b1', signature: 'v2:1' } }
			})
		).toBeNull()
		expect(
			planFirstOpenFill({
				thumbnailUrl: '/api/scenes/s1/thumbnail/a1',
				shadows: { enabled: false }
			})
		).toBeNull()
	})
})

describe('waitForSettledBake', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('polls until the capture has a bake, treating a failed capture as not yet', async () => {
		vi.useFakeTimers()
		const capture = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockRejectedValueOnce(new Error('context lost'))
			.mockResolvedValueOnce(bake)

		const settled = waitForSettledBake(capture, { intervalMs: 500 })
		await vi.advanceTimersByTimeAsync(1000)

		expect(await settled).toBe(true)
		expect(capture).toHaveBeenCalledTimes(3)
	})

	it('gives up at the timeout, and stops when cancelled', async () => {
		vi.useFakeTimers()
		const never = vi.fn().mockResolvedValue(null)

		const timedOut = waitForSettledBake(never, {
			intervalMs: 500,
			timeoutMs: 2000
		})
		await vi.advanceTimersByTimeAsync(2500)
		expect(await timedOut).toBe(false)
		const pollsUntilTimeout = never.mock.calls.length
		expect(pollsUntilTimeout).toBeLessThanOrEqual(5)

		never.mockClear()
		let cancelled = false
		const stopped = waitForSettledBake(never, {
			intervalMs: 500,
			isCancelled: () => cancelled
		})
		await vi.advanceTimersByTimeAsync(500)
		cancelled = true
		await vi.advanceTimersByTimeAsync(5000)
		expect(await stopped).toBe(false)
		expect(never.mock.calls.length).toBeLessThanOrEqual(2)
	})
})
