import { describe, expect, it } from 'vitest'

import { makeNoise2d, makePrng, seedFromSlug } from './prng'

describe('seedFromSlug', () => {
	it('is deterministic for the same slug', () => {
		expect(seedFromSlug('camera-presets')).toBe(seedFromSlug('camera-presets'))
	})

	it('differs between slugs', () => {
		expect(seedFromSlug('camera-presets')).not.toBe(seedFromSlug('api-keys-101'))
	})

	it('returns a non-negative 32-bit integer', () => {
		const seed = seedFromSlug('gltf-vs-glb-what-actually-matters')
		expect(Number.isInteger(seed)).toBe(true)
		expect(seed).toBeGreaterThanOrEqual(0)
		expect(seed).toBeLessThan(2 ** 32)
	})
})

describe('makePrng', () => {
	it('produces the same sequence for the same seed', () => {
		const a = makePrng(42)
		const b = makePrng(42)
		expect([a(), a(), a()]).toEqual([b(), b(), b()])
	})

	it('stays within [0, 1)', () => {
		const rand = makePrng(7)
		for (let i = 0; i < 500; i++) {
			const value = rand()
			expect(value).toBeGreaterThanOrEqual(0)
			expect(value).toBeLessThan(1)
		}
	})
})

describe('makeNoise2d', () => {
	it('is deterministic', () => {
		const a = makeNoise2d(11)
		const b = makeNoise2d(11)
		expect(a(3.2, 7.9)).toBe(b(3.2, 7.9))
	})

	it('stays within [0, 1]', () => {
		const noise = makeNoise2d(3)
		for (let i = 0; i < 200; i++) {
			const value = noise(i * 0.37, i * 0.11)
			expect(value).toBeGreaterThanOrEqual(0)
			expect(value).toBeLessThanOrEqual(1)
		}
	})

	it('varies smoothly rather than jumping between neighbours', () => {
		const noise = makeNoise2d(5)
		const delta = Math.abs(noise(4.0, 4.0) - noise(4.02, 4.0))
		expect(delta).toBeLessThan(0.1)
	})
})
