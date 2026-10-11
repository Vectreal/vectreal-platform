import { describe, expect, it } from 'vitest'

import { createSeededRandom, jitterLightPositions } from './shadow-light-jitter'

const options = {
	position: [1, 2, 2] as const,
	radius: 0.8,
	ambient: 0.3,
	amount: 64
}

describe('createSeededRandom', () => {
	it('repeats its sequence for the same seed', () => {
		const a = createSeededRandom(42)
		const b = createSeededRandom(42)
		const first = Array.from({ length: 16 }, a)
		expect(Array.from({ length: 16 }, b)).toEqual(first)
	})

	it('gives a different sequence for a different seed', () => {
		const a = Array.from({ length: 16 }, createSeededRandom(42))
		const b = Array.from({ length: 16 }, createSeededRandom(43))
		expect(b).not.toEqual(a)
	})

	it('stays in [0, 1)', () => {
		const random = createSeededRandom(7)
		for (let i = 0; i < 10_000; i++) {
			const value = random()
			expect(value).toBeGreaterThanOrEqual(0)
			expect(value).toBeLessThan(1)
		}
	})
})

describe('jitterLightPositions', () => {
	it('places the same lights for the same seed', () => {
		expect(jitterLightPositions(createSeededRandom(1), options)).toEqual(
			jitterLightPositions(createSeededRandom(1), options)
		)
	})

	it('keeps key-light samples inside the jitter box', () => {
		const lights = jitterLightPositions(createSeededRandom(2), {
			...options,
			ambient: 0
		})
		for (const light of lights) {
			light.forEach((axis, i) => {
				expect(Math.abs(axis - options.position[i])).toBeLessThanOrEqual(
					options.radius / 2
				)
			})
		}
	})

	it('puts fill samples on the upper hemisphere at the key light distance', () => {
		const distance = Math.hypot(...options.position)
		const lights = jitterLightPositions(createSeededRandom(3), {
			...options,
			ambient: 1
		})
		for (const light of lights) {
			expect(Math.hypot(...light)).toBeCloseTo(distance, 9)
			expect(light[1]).toBeGreaterThanOrEqual(0)
		}
	})

	it('mixes both distributions by the ambient fraction', () => {
		const lights = jitterLightPositions(createSeededRandom(4), {
			...options,
			amount: 2000
		})
		const nearKey = lights.filter((light) =>
			light.every(
				(axis, i) => Math.abs(axis - options.position[i]) <= options.radius / 2
			)
		).length
		// Hemisphere samples can land in the box too, so this only bounds it.
		expect(nearKey / lights.length).toBeGreaterThan(0.6)
		expect(nearKey / lights.length).toBeLessThan(0.8)
	})
})
