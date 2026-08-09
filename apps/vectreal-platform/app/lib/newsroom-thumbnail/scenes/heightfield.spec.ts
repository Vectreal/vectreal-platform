import { describe, expect, it } from 'vitest'

import { BAKED_GRID, PREVIEW_GRID, heightfield } from './heightfield'

const VIEWPORT = { width: 1200, height: 480 }

describe('heightfield', () => {
	it('produces byte-identical output for the same seed', () => {
		const a = heightfield(1337, { viewport: VIEWPORT })
		const b = heightfield(1337, { viewport: VIEWPORT })
		expect(JSON.stringify(a)).toBe(JSON.stringify(b))
	})

	it('produces different output for different seeds', () => {
		const a = heightfield(1337, { viewport: VIEWPORT })
		const b = heightfield(9001, { viewport: VIEWPORT })
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
	})

	it('emits a non-empty set of finite segments', () => {
		const segments = heightfield(42, { viewport: VIEWPORT })

		expect(segments.length).toBeGreaterThan(0)

		for (const segment of segments) {
			expect(Number.isFinite(segment.x1)).toBe(true)
			expect(Number.isFinite(segment.y1)).toBe(true)
			expect(Number.isFinite(segment.x2)).toBe(true)
			expect(Number.isFinite(segment.y2)).toBe(true)
			expect(segment.opacity).toBeGreaterThan(0)
			expect(segment.opacity).toBeLessThanOrEqual(1)
		}
	})

	it('paints far segments before near ones', () => {
		const segments = heightfield(42, { viewport: VIEWPORT })
		const first = segments[0]
		const last = segments[segments.length - 1]

		// Fog opacity falls with depth, so the far-first ordering shows up as a
		// dimmer first segment than last.
		expect(first.opacity).toBeLessThan(last.opacity)
	})

	it('marks some but not all segments as accent', () => {
		const segments = heightfield(1337, { viewport: VIEWPORT })
		const accented = segments.filter((segment) => segment.accent)

		expect(accented.length).toBeGreaterThan(0)
		expect(accented.length).toBeLessThan(segments.length)
	})

	it('emits more segments at baked density than at preview density', () => {
		const preview = heightfield(42, { viewport: VIEWPORT, grid: PREVIEW_GRID })
		const baked = heightfield(42, { viewport: VIEWPORT, grid: BAKED_GRID })

		expect(baked.length).toBeGreaterThan(preview.length)
	})

	it('defaults to baked density so shipped output never varies by caller', () => {
		const explicit = heightfield(42, { viewport: VIEWPORT, grid: BAKED_GRID })
		const implicit = heightfield(42, { viewport: VIEWPORT })

		expect(implicit.length).toBe(explicit.length)
	})

	it('keeps the same terrain extent across densities', () => {
		// Densities subsample one landscape rather than generating smaller ones.
		// When this broke, the low-density scene collapsed into an island
		// floating mid-frame instead of filling the lower two thirds.
		const spread = (grid: { nx: number; nz: number }) => {
			const xs = heightfield(42, { viewport: VIEWPORT, grid }).flatMap(
				(segment) => [segment.x1, segment.x2]
			)

			return Math.max(...xs) - Math.min(...xs)
		}

		const baked = spread(BAKED_GRID)
		const preview = spread(PREVIEW_GRID)

		expect(Math.abs(baked - preview) / baked).toBeLessThan(0.05)
	})
})
