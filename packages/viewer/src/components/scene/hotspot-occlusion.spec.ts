import { describe, expect, it } from 'vitest'

import { occlusionRayFar } from './hotspot-occlusion'

describe('occlusionRayFar', () => {
	it('stops the ray short of the hotspot itself', () => {
		// The whole reason this function exists: a hotspot is authored by
		// raycasting the model and storing the hit verbatim, so it sits exactly on
		// a triangle. A ray cast the full distance hits that triangle and reports
		// the hotspot as occluded by the surface it is pinned to.
		expect(occlusionRayFar(4)).toBeLessThan(4)
	})

	it('scales the gap with distance so it holds at any model size', () => {
		const near = 4 - occlusionRayFar(4)
		const far = 40 - occlusionRayFar(40)

		// Proportional, not merely larger: a flat epsilon also grows by a float
		// ulp here, so `far > near` would pass without the gap scaling at all.
		expect(far).toBeGreaterThan(near * 5)
	})

	it('keeps the gap small enough to still detect a real occluder', () => {
		// A wall 2% of the way in front of the hotspot must still register.
		expect(occlusionRayFar(4)).toBeGreaterThan(4 * 0.98)
	})

	it('keeps a gap even as the distance approaches zero', () => {
		expect(occlusionRayFar(1e-6)).toBe(0)
		expect(occlusionRayFar(1e-3)).toBeLessThan(1e-3)
	})

	it.each([
		['zero', 0],
		['a negative distance', -1],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY]
	])('reports nothing to cast against for %s', (_label, distance) => {
		expect(occlusionRayFar(distance)).toBe(0)
	})
})
