/**
 * The transition editor spreads the normalized transition into every edit, so
 * normalizing has to fill exactly what each type uses: a type change keeps
 * the timing the new type can use and defaults the rest.
 */
import { describe, expect, it } from 'vitest'

import { normalizeTransition } from './camera-state'

describe('normalizeTransition', () => {
	it('reads a scene with no transition as a smooth one-second move', () => {
		expect(normalizeTransition(undefined)).toEqual({
			type: 'linear',
			duration: 1000,
			easing: 'ease_in_out'
		})
	})

	it('drops the path parameters a smart move saved before they lost meaning', () => {
		expect(
			normalizeTransition({
				type: 'object_avoidance',
				duration: 400,
				objectAvoidance: {
					clearance: 2,
					arcHeight: 2,
					samples: 24,
					tension: 0.5
				}
			})
		).toEqual({
			type: 'object_avoidance',
			duration: 400,
			easing: 'ease_in_out'
		})
	})

	it('keeps the timing when a smart move becomes linear', () => {
		const smart = normalizeTransition({
			type: 'object_avoidance',
			duration: 400,
			easing: 'ease_out'
		})

		expect(normalizeTransition({ ...smart, type: 'linear' })).toEqual({
			type: 'linear',
			duration: 400,
			easing: 'ease_out'
		})
	})

	it('drops everything but the type for an instant cut', () => {
		expect(
			normalizeTransition({ type: 'none', duration: 400, easing: 'linear' })
		).toEqual({ type: 'none' })
	})
})
