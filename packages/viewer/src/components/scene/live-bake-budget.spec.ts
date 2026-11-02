// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	estimateLiveBakeDraws,
	hasCoarsePrimaryPointer,
	LIVE_BAKE_DRAW_BUDGET,
	liveBakeSkipReason
} from './live-bake-budget'

/**
 * A live ground bake put up to 24,975 draw calls in a single frame on the
 * published Porsche, and iOS Safari dropped the WebGL context under it.
 */

// jsdom has no `matchMedia`, so each case installs its own.
const pointer = (query: string) =>
	vi.stubGlobal(
		'matchMedia',
		(media: string) => ({ matches: media === query, media }) as MediaQueryList
	)

describe('hasCoarsePrimaryPointer', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('is true for a phone or tablet, whose primary pointer is a finger', () => {
		pointer('(pointer: coarse)')
		expect(hasCoarsePrimaryPointer()).toBe(true)
	})

	it('is false for a touch laptop whose primary pointer is fine', () => {
		pointer('(pointer: fine)')
		expect(hasCoarsePrimaryPointer()).toBe(false)
	})

	it('is false where the browser cannot answer', () => {
		vi.stubGlobal('matchMedia', undefined)
		expect(hasCoarsePrimaryPointer()).toBe(false)
	})
})

describe('estimateLiveBakeDraws', () => {
	it('matches the draw calls measured on the Porsche', () => {
		// 1,664 meshes, the publisher's two lights, transmissive glass:
		// 24,975 draw calls measured in WebKit in the bake's heaviest frame.
		const estimate = estimateLiveBakeDraws({
			meshCount: 1_664,
			bakeShadowLights: 8,
			sceneLights: 2,
			transmissive: true
		})
		expect(estimate).toBe(24_960)
		expect(Math.abs(estimate - 24_975) / 24_975).toBeLessThan(0.01)
	})

	it('drops the transmission pass for a model that transmits nothing', () => {
		expect(
			estimateLiveBakeDraws({
				meshCount: 100,
				bakeShadowLights: 8,
				sceneLights: 1,
				transmissive: false
			})
		).toBe(100 * 12)
	})
})

describe('liveBakeSkipReason', () => {
	const within = LIVE_BAKE_DRAW_BUDGET

	it('never skips where any live bake is allowed', () => {
		expect(
			liveBakeSkipReason({
				mode: 'always',
				coarsePointer: true,
				estimatedDraws: within * 10
			})
		).toBeNull()
	})

	it('skips on a phone or tablet whatever the scene costs', () => {
		expect(
			liveBakeSkipReason({
				mode: 'within-budget',
				coarsePointer: true,
				estimatedDraws: 1
			})
		).toBe('touch_device')
	})

	it('bakes on a desktop up to the budget, and skips above it', () => {
		const at = (estimatedDraws: number) =>
			liveBakeSkipReason({
				mode: 'within-budget',
				coarsePointer: false,
				estimatedDraws
			})
		expect(at(within)).toBeNull()
		expect(at(within + 1)).toBe('over_budget')
	})

	it('still lets a desktop bake the Porsche', () => {
		expect(
			liveBakeSkipReason({
				mode: 'within-budget',
				coarsePointer: false,
				estimatedDraws: 24_960
			})
		).toBeNull()
	})
})
