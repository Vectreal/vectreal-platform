import { describe, expect, it } from 'vitest'

import { occlusionRayFar } from './hotspot-occlusion'

/** A model whose bounding-box diagonal is 4 units, the middle of the range. */
const DIAGONAL = 4

describe('occlusionRayFar', () => {
	it('stops the ray short of the hotspot itself', () => {
		// The whole reason this function exists: a hotspot is authored by
		// raycasting the model and storing the hit verbatim, so it sits exactly on
		// a triangle. A ray cast the full distance hits that triangle and reports
		// the hotspot as occluded by the surface it is pinned to.
		expect(occlusionRayFar(4, DIAGONAL)).toBeLessThan(4)
	})

	it('scales the gap with the model, so it holds at any model size', () => {
		const small = 4 - occlusionRayFar(4, 0.5)
		const large = 4 - occlusionRayFar(4, 5)

		// Proportional, not merely larger: a flat epsilon also grows by a float
		// ulp here, so `large > small` would pass without the gap scaling at all.
		expect(large).toBeGreaterThan(small * 5)
	})

	it('stops the gap growing once the camera is beyond the model', () => {
		// The defect this replaced. Taking the tolerance from camera distance alone
		// made the slack unbounded: nothing bounds the dolly, so zooming out grew
		// it until a marker behind real geometry stopped dimming. Past the model's
		// own size the model is the smaller reference, so the slack stops moving.
		const atModelSize = 200 - occlusionRayFar(200, DIAGONAL)
		const farBeyond = 20000 - occlusionRayFar(20000, DIAGONAL)

		expect(farBeyond).toBeCloseTo(atModelSize, 10)
		// And it is the model that set it, not the distance.
		expect(farBeyond).toBeCloseTo(DIAGONAL * 0.005, 10)
	})

	it('keeps the gap small enough to still detect a real occluder', () => {
		// A wall 2% of the way in front of the hotspot must still register.
		expect(occlusionRayFar(4, DIAGONAL)).toBeGreaterThan(4 * 0.98)
	})

	it('keeps a large model from swallowing a close occluder', () => {
		// Normalization is off by default, so a 200-unit model is the ordinary
		// case. Orbiting in to 3 units, 0.5% of the model would be a whole world
		// unit of slack and a railing in front of the marker would stop occluding
		// it. The distance is the smaller reference here, so it wins.
		const slack = 3 - occlusionRayFar(3, 200)

		expect(slack).toBeCloseTo(3 * 0.005, 10)
	})

	it('lets the model bound the slack once the camera is further than it', () => {
		const slack = 500 - occlusionRayFar(500, 4)

		expect(slack).toBeCloseTo(4 * 0.005, 10)
	})

	it('keeps a gap even as the distance approaches zero', () => {
		expect(occlusionRayFar(1e-6, DIAGONAL)).toBe(0)
		expect(occlusionRayFar(1e-3, DIAGONAL)).toBeLessThan(1e-3)
	})

	it('falls back to the camera distance when the model has no size yet', () => {
		// The first pass can run before the bounding box has been measured. A zero
		// diagonal must behave exactly as the camera-distance reference, not fall
		// through to the 1e-4 floor - that would be 200x too small at this
		// distance and report every marker as occluded by its own triangle.
		const withoutModel = 4 - occlusionRayFar(4, 0)
		const cameraReference = 4 - occlusionRayFar(4, 4)

		expect(withoutModel).toBeCloseTo(cameraReference, 10)
		expect(4 - occlusionRayFar(4, Number.NaN)).toBeCloseTo(cameraReference, 10)
	})

	it.each([
		['zero', 0],
		['a negative distance', -1],
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY]
	])('reports nothing to cast against for %s', (_label, distance) => {
		expect(occlusionRayFar(distance, DIAGONAL)).toBe(0)
	})
})
