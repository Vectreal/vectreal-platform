import { describe, expect, it, vi } from 'vitest'

import { BakeError, bakeWithRecovery, lowerDetail } from './bake-outcome'

import type { WebGLRenderer } from 'three'

const OPTIONS = { resolution: 512, samples: 256, distance: 0.25 }

/** A renderer that only knows whether its context is lost, and is disposed. */
function fakeRenderer({ lost = false } = {}) {
	return {
		dispose: vi.fn(),
		forceContextLoss: vi.fn(),
		getContext: () => ({ isContextLost: () => lost })
	} as unknown as WebGLRenderer & {
		dispose: ReturnType<typeof vi.fn>
		forceContextLoss: ReturnType<typeof vi.fn>
	}
}

/** Makes a fresh fake per call and keeps each one to inspect. */
function rendererFactory(options?: { lost?: boolean }) {
	const made: ReturnType<typeof fakeRenderer>[] = []
	const make = vi.fn(() => {
		const renderer = fakeRenderer(options)
		made.push(renderer)
		return renderer
	})
	return { make, made }
}

const reset = () => new BakeError('gpu-reset', 'The GPU reset while baking x')

describe('bakeWithRecovery', () => {
	it('returns the report as it is when the first attempt holds', async () => {
		const { make, made } = rendererFactory()
		const result = await bakeWithRecovery(
			async (renderer) => {
				renderer()
				return { baked: ['Body'], skipped: [] }
			},
			make,
			OPTIONS
		)
		expect(result).toEqual({ baked: ['Body'], skipped: [] })
		expect(made).toHaveLength(1)
		expect(made[0].dispose).toHaveBeenCalledOnce()
	})

	it('makes no renderer for a bake that never asks for one', async () => {
		const { make } = rendererFactory()
		await bakeWithRecovery(
			async () => ({ baked: [], skipped: [] }),
			make,
			OPTIONS
		)
		expect(make).not.toHaveBeenCalled()
	})

	it('draws again on a fresh renderer after one reset, as asked', async () => {
		const { make, made } = rendererFactory()
		const seen: (typeof OPTIONS)[] = []
		const result = await bakeWithRecovery(
			async (renderer, options) => {
				const current = renderer()
				seen.push(options)
				if (seen.length === 1) throw reset()
				expect(current).not.toBe(made[0])
				return { baked: ['Body'], skipped: [] }
			},
			make,
			OPTIONS
		)
		expect(result).toEqual({
			baked: ['Body'],
			skipped: [],
			recovered: 'retried'
		})
		expect(seen).toEqual([OPTIONS, OPTIONS])
		expect(made.map((r) => r.dispose.mock.calls.length)).toEqual([1, 1])
	})

	it('draws at lower detail after a second reset, and says so', async () => {
		const { make, made } = rendererFactory()
		const seen: (typeof OPTIONS)[] = []
		const result = await bakeWithRecovery(
			async (renderer, options) => {
				renderer()
				seen.push(options)
				if (seen.length < 3) throw reset()
				return { baked: ['Body'], skipped: [] }
			},
			make,
			OPTIONS
		)
		expect(result).toMatchObject({ recovered: 'lower-detail' })
		expect(seen[2]).toEqual({ resolution: 256, samples: 128, distance: 0.25 })
		expect(made).toHaveLength(3)
		for (const renderer of made) expect(renderer.dispose).toHaveBeenCalledOnce()
	})

	it('gives up after three resets with the reason and the error behind it', async () => {
		const { make, made } = rendererFactory()
		const bake = vi.fn(async (renderer: () => WebGLRenderer) => {
			renderer()
			throw reset()
		})
		const result = await bakeWithRecovery(bake, make, OPTIONS)
		expect(result).toEqual({
			failed: 'gpu-reset',
			detail: 'The GPU reset while baking x'
		})
		expect(bake).toHaveBeenCalledTimes(3)
		for (const renderer of made) expect(renderer.dispose).toHaveBeenCalledOnce()
	})

	it('counts any error on a lost context as a reset', async () => {
		const { make } = rendererFactory({ lost: true })
		const bake = vi.fn(async (renderer: () => WebGLRenderer) => {
			renderer()
			throw new Error('readPixels: context lost')
		})
		const result = await bakeWithRecovery(bake, make, OPTIONS)
		expect(result).toMatchObject({ failed: 'gpu-reset' })
		expect(bake).toHaveBeenCalledTimes(3)
	})

	it('does not retry when no renderer can be made', async () => {
		const make = vi.fn(() => {
			throw new Error('Error creating WebGL context.')
		})
		const bake = vi.fn(async (renderer: () => WebGLRenderer) => {
			renderer()
			return { baked: [], skipped: [] }
		})
		const result = await bakeWithRecovery(bake, make, OPTIONS)
		expect(result).toEqual({
			failed: 'no-webgl',
			detail: 'Error creating WebGL context.'
		})
		expect(bake).toHaveBeenCalledOnce()
	})

	it('does not retry an unexpected error, and still disposes the renderer', async () => {
		const { make, made } = rendererFactory()
		const bake = vi.fn(async (renderer: () => WebGLRenderer) => {
			renderer()
			throw new TypeError('undefined is not a function')
		})
		const result = await bakeWithRecovery(bake, make, OPTIONS)
		expect(result).toEqual({
			failed: 'unexpected',
			detail: 'undefined is not a function'
		})
		expect(bake).toHaveBeenCalledOnce()
		expect(made[0].dispose).toHaveBeenCalledOnce()
	})

	it('releases each renderer’s WebGL context, not only its resources', async () => {
		const { make, made } = rendererFactory()
		await bakeWithRecovery(
			async (renderer) => {
				renderer()
				if (made.length < 2) throw reset()
				return { baked: [], skipped: [] }
			},
			make,
			OPTIONS
		)
		for (const renderer of made) {
			expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
		}
	})

	it('still resolves, and lets the context go, when dispose throws', async () => {
		const made: ReturnType<typeof fakeRenderer>[] = []
		const make = vi.fn(() => {
			const renderer = fakeRenderer()
			made.push(renderer)
			renderer.dispose.mockImplementation(() => {
				throw new Error('context already gone')
			})
			return renderer
		})
		const result = await bakeWithRecovery(
			async (renderer) => {
				renderer()
				return { baked: ['Body'], skipped: [] }
			},
			make,
			OPTIONS
		)
		expect(result).toEqual({ baked: ['Body'], skipped: [] })
		expect(made[0].forceContextLoss).toHaveBeenCalledOnce()
	})

	it('keeps the reset as the reason when the browser then refuses a new context', async () => {
		let calls = 0
		const make = vi.fn(() => {
			if (calls++ > 0)
				throw new Error('Web page caused context loss and was blocked')
			return fakeRenderer()
		})
		const result = await bakeWithRecovery(
			async (renderer) => {
				renderer()
				throw reset()
			},
			make,
			OPTIONS
		)
		expect(result).toEqual({
			failed: 'gpu-reset',
			detail: 'The GPU reset while baking x'
		})
	})
})

describe('lowerDetail', () => {
	it('halves resolution and samples and keeps the rest', () => {
		expect(lowerDetail(OPTIONS)).toEqual({
			resolution: 256,
			samples: 128,
			distance: 0.25
		})
		expect(OPTIONS.resolution).toBe(512)
	})
})
