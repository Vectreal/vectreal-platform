import { describe, expect, it, vi } from 'vitest'

import {
	gpuSettled,
	gpuTimeMs,
	MAX_SAMPLES_PER_DRAW,
	MIN_SLICE_BUDGET,
	nextSliceBudget,
	slicesOf,
	TARGET_SLICE_MS,
	type Slice
} from './gpu-slices'

/** How many slices traced each ray of each texel. */
function coverage(size: number, samples: number, slices: Slice[]) {
	const counts = new Uint8Array(size * size * samples)
	for (const { tile, firstSample, samples: count } of slices) {
		const { x, y, width, height } = tile
		expect(width).toBeGreaterThan(0)
		expect(height).toBeGreaterThan(0)
		expect(x).toBeGreaterThanOrEqual(0)
		expect(y).toBeGreaterThanOrEqual(0)
		expect(x + width).toBeLessThanOrEqual(size)
		expect(y + height).toBeLessThanOrEqual(size)
		expect(count).toBeGreaterThan(0)
		expect(count).toBeLessThanOrEqual(MAX_SAMPLES_PER_DRAW)
		for (let row = y; row < y + height; row++) {
			for (let column = x; column < x + width; column++) {
				for (let k = firstSample; k < firstSample + count; k++) {
					counts[(row * size + column) * samples + k]++
				}
			}
		}
	}
	return counts
}

const everyRayOnce = (counts: Uint8Array) =>
	counts.every((count) => count === 1)

describe('slicesOf', () => {
	it.each([
		[12, 6, 1],
		[32, 40, 7 * 5],
		[32, 40, 32 * 32 * 3],
		[32, 40, 32 * 32 * 64],
		[7, 3, 1],
		[30, 17, 30 * 30 * 16]
	])(
		'traces every ray of a %i target with %i samples once at budget %i',
		(size, samples, budget) => {
			const slices = [...slicesOf(size, samples, () => budget)]
			expect(everyRayOnce(coverage(size, samples, slices))).toBe(true)
		}
	)

	it('traces every ray once while the budget changes between slices', () => {
		// As the tracer does: a new budget after every slice drawn, here
		// swinging between tiles of one ray and the whole target at several.
		const small = [300, 50, 1000, 9]
		const large = [64 * 64 * 3, 64 * 64 * 20, 64 * 64]
		const next = (drawn: number) =>
			drawn % 40 < 30
				? small[drawn % small.length]
				: large[drawn % large.length]
		let budget = next(0)
		const slices: Slice[] = []
		for (const slice of slicesOf(64, 48, () => budget)) {
			slices.push(slice)
			budget = next(slices.length)
		}
		expect(everyRayOnce(coverage(64, 48, slices))).toBe(true)
		// Both kinds of slice were drawn.
		expect(slices.some(({ tile }) => tile.width < 64)).toBe(true)
		expect(slices.some(({ samples }) => samples > 1)).toBe(true)
	})

	it('draws the whole target with as many rays as the budget covers', () => {
		expect([...slicesOf(64, 10, () => 64 * 64 * 4)]).toEqual([
			{
				tile: { x: 0, y: 0, width: 64, height: 64 },
				firstSample: 0,
				samples: 4
			},
			{
				tile: { x: 0, y: 0, width: 64, height: 64 },
				firstSample: 4,
				samples: 4
			},
			{
				tile: { x: 0, y: 0, width: 64, height: 64 },
				firstSample: 8,
				samples: 2
			}
		])
	})

	it('never draws more rays at once than before slicing', () => {
		const slices = [...slicesOf(16, 40, () => 16 * 16 * 1000)]
		expect(slices.map(({ samples }) => samples)).toEqual([16, 16, 8])
	})

	it('splits one ray into tiles of the budget once it cannot cover the target', () => {
		let budget = 16 * 16
		const slices = slicesOf(64, 2, () => budget)
		expect(slices.next().value).toEqual({
			tile: { x: 0, y: 0, width: 16, height: 16 },
			firstSample: 0,
			samples: 1
		})
		budget = 16 * 8
		expect(slices.next().value).toEqual({
			tile: { x: 16, y: 0, width: 8, height: 16 },
			firstSample: 0,
			samples: 1
		})
	})
})

describe('nextSliceBudget', () => {
	const max = 512 * 512 * 16

	it('paces the budget to the target time from the work drawn', () => {
		expect(nextSliceBudget(4096, 4096, TARGET_SLICE_MS * 2, max)).toBe(2048)
		expect(nextSliceBudget(4096, 4096, TARGET_SLICE_MS * 4, max)).toBe(1024)
		expect(nextSliceBudget(4096, 4096, TARGET_SLICE_MS, max)).toBe(4096)
		expect(nextSliceBudget(4096, 3000, TARGET_SLICE_MS, max)).toBe(3000)
		expect(nextSliceBudget(4096, 4096, (TARGET_SLICE_MS * 2) / 3, max)).toBe(
			6144
		)
	})

	it('at most doubles the budget from one slice to the next', () => {
		expect(nextSliceBudget(4096, 4096, TARGET_SLICE_MS / 10, max)).toBe(8192)
		expect(nextSliceBudget(4096, 4096, 0, max)).toBe(8192)
	})

	it('keeps the budget after a slice cut short by the edge or the last rays', () => {
		expect(nextSliceBudget(4096, 2047, 0.1, max)).toBe(4096)
		expect(nextSliceBudget(4096, 2047, 1000, max)).toBe(4096)
		expect(nextSliceBudget(4096, 2048, TARGET_SLICE_MS, max)).toBe(2048)
	})

	it('stays between the smallest slice and the whole target at full rays', () => {
		expect(nextSliceBudget(MIN_SLICE_BUDGET, MIN_SLICE_BUDGET, 1000, max)).toBe(
			MIN_SLICE_BUDGET
		)
		expect(nextSliceBudget(max, max, 0, max)).toBe(max)
	})
})

/*
  A WebGL2 context whose fence reports each status in `statuses` in turn, one
  per poll.
*/
function fencedContext(statuses: number[]) {
	const constants = {
		SYNC_FLUSH_COMMANDS_BIT: 1,
		TIMEOUT_EXPIRED: 0x911b,
		ALREADY_SIGNALED: 0x911a,
		CONDITION_SATISFIED: 0x911c,
		WAIT_FAILED: 0x911d
	}
	let poll = 0
	const gl = {
		...constants,
		clientWaitSync: vi.fn(() => statuses[poll++]),
		deleteSync: vi.fn()
	}
	return { gl, constants }
}

describe('gpuSettled', () => {
	it('waits until the fence signals, yielding a task between polls', async () => {
		const { gl, constants } = fencedContext([0x911b, 0x911b, 0x911c])
		const fence = {} as WebGLSync
		let settled = false
		const waiting = gpuSettled(gl as never, fence).then(() => (settled = true))

		await Promise.resolve()
		expect(settled).toBe(false)
		expect(gl.clientWaitSync).toHaveBeenCalledTimes(1)
		expect(gl.deleteSync).not.toHaveBeenCalled()

		await waiting
		expect(gl.clientWaitSync).toHaveBeenCalledTimes(3)
		expect(gl.clientWaitSync.mock.calls).toEqual([
			[fence, constants.SYNC_FLUSH_COMMANDS_BIT, 0],
			[fence, 0, 0],
			[fence, 0, 0]
		])
		expect(gl.deleteSync).toHaveBeenCalledWith(fence)
	})

	it('returns at once for a fence already signaled', async () => {
		const { gl } = fencedContext([0x911a])
		await gpuSettled(gl as never, {} as WebGLSync)
		expect(gl.clientWaitSync).toHaveBeenCalledTimes(1)
		expect(gl.deleteSync).toHaveBeenCalledOnce()
	})

	it('stops waiting when the wait fails, as on a lost context', async () => {
		const { gl } = fencedContext([0x911b, 0x911d])
		await gpuSettled(gl as never, {} as WebGLSync)
		expect(gl.clientWaitSync).toHaveBeenCalledTimes(2)
		expect(gl.deleteSync).toHaveBeenCalledOnce()
	})
})

/*
  A WebGL2 context with one timer query: whether its result is in, whether
  the GPU clock jumped, and the nanoseconds it measured.
*/
function timedContext(ready: boolean, disjoint: boolean, nanoseconds: number) {
	const gl = {
		QUERY_RESULT: 0x8866,
		QUERY_RESULT_AVAILABLE: 0x8867,
		getQueryParameter: vi.fn((_query: WebGLQuery, name: number) =>
			name === 0x8867 ? ready : nanoseconds
		),
		getParameter: vi.fn(() => disjoint),
		deleteQuery: vi.fn()
	}
	const timer = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb }
	return { gl, timer }
}

describe('gpuTimeMs', () => {
	const query = {} as WebGLQuery

	it('reads the GPU time in milliseconds and deletes the query', () => {
		const { gl, timer } = timedContext(true, false, 4_500_000)
		expect(gpuTimeMs(gl as never, timer, query)).toBe(4.5)
		expect(gl.deleteQuery).toHaveBeenCalledWith(query)
	})

	it('has no time while the result is not in yet', () => {
		const { gl, timer } = timedContext(false, false, 4_500_000)
		expect(gpuTimeMs(gl as never, timer, query)).toBeUndefined()
		expect(gl.deleteQuery).toHaveBeenCalledWith(query)
	})

	it('has no time when the GPU clock jumped during the query', () => {
		const { gl, timer } = timedContext(true, true, 4_500_000)
		expect(gpuTimeMs(gl as never, timer, query)).toBeUndefined()
		expect(gl.deleteQuery).toHaveBeenCalledWith(query)
	})
})
