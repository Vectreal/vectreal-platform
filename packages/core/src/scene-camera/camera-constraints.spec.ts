import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
	defaultCameraConstraints,
	orbitAnchor,
	orbitLimitsFor,
	resolveCameraConstraints
} from './camera-constraints'
import { clampToOrbitLimits } from './orbit-limits'

const RADIANS = Math.PI / 180
const up = new Vector3(0, 1, 0)
const origin = new Vector3()

describe('resolveCameraConstraints', () => {
	describe('a camera without limits of its own', () => {
		it('is held to the scene-wide controls, exactly as before', () => {
			expect(
				resolveCameraConstraints(undefined, {
					enableZoom: false,
					enablePan: false,
					minDistance: 2,
					maxDistance: 9,
					minPolarAngle: 0.2,
					maxPolarAngle: Math.PI / 2,
					minAzimuthAngle: -1,
					maxAzimuthAngle: 1
				})
			).toEqual({
				zoom: false,
				pan: false,
				rotate: true,
				distance: { relative: false, min: 2, max: 9 },
				polar: { min: 0.2, max: Math.PI / 2 },
				azimuth: { relative: false, min: -1, max: 1 }
			})
		})

		it('is not limited where the scene sets nothing', () => {
			expect(resolveCameraConstraints(undefined, {})).toEqual({
				zoom: true,
				pan: true,
				rotate: true,
				distance: { relative: false, min: 0, max: Infinity },
				polar: { min: 0, max: Math.PI },
				azimuth: { relative: false, min: -Infinity, max: Infinity }
			})
		})
	})

	describe('a camera with limits', () => {
		it('owns all of them: the scene-wide limits no longer apply', () => {
			const resolved = resolveCameraConstraints(
				{ zoom: { closer: 2, farther: 3 }, pan: false },
				{ enableZoom: false, maxPolarAngle: 0.5, minDistance: 4 }
			)
			expect(resolved.zoom).toBe(true)
			expect(resolved.pan).toBe(false)
			expect(resolved.distance).toEqual({
				relative: true,
				closer: 2,
				farther: 3
			})
			// Tilt and orbit were left out: not limited.
			expect(resolved.polar).toEqual({ min: 0, max: Math.PI })
			expect(resolved.azimuth).toEqual({
				relative: false,
				min: -Infinity,
				max: Infinity
			})
		})

		it('reads tilt as elevation: the highest is the smallest polar angle', () => {
			const { polar } = resolveCameraConstraints(
				{ tilt: { lowest: 0, highest: 85 } },
				{}
			)
			expect(polar.min).toBeCloseTo(5 * RADIANS)
			expect(polar.max).toBeCloseTo(Math.PI / 2)
		})

		it('turns off zoom only for a literal false', () => {
			expect(
				resolveCameraConstraints({ zoom: { enabled: false } }, {}).zoom
			).toBe(false)
			expect(resolveCameraConstraints({ zoom: {} }, {}).zoom).toBe(true)
		})

		it('keeps the scene turning rotation off, which has no camera setting', () => {
			expect(
				resolveCameraConstraints({ pan: true }, { enableRotate: false }).rotate
			).toBe(false)
		})
	})
})

describe('orbitLimitsFor', () => {
	const anchor = { distance: 4, azimuth: 0.5 }

	it('measures zoom and orbit from the camera’s own view', () => {
		const limits = orbitLimitsFor(
			resolveCameraConstraints(
				{ zoom: { closer: 2, farther: 2 }, orbit: { left: 30, right: 45 } },
				{}
			),
			anchor
		)
		expect(limits.minDistance).toBe(2)
		expect(limits.maxDistance).toBe(8)
		expect(limits.minAzimuthAngle).toBeCloseTo(0.5 - 30 * RADIANS)
		expect(limits.maxAzimuthAngle).toBeCloseTo(0.5 + 45 * RADIANS)
	})

	it('leaves the distance open where zoom has no limit', () => {
		const limits = orbitLimitsFor(resolveCameraConstraints({}, {}), anchor)
		expect(limits.minDistance).toBe(0)
		expect(limits.maxDistance).toBe(Infinity)
	})

	it('does not limit the orbit once left and right meet behind the target', () => {
		const limits = orbitLimitsFor(
			resolveCameraConstraints({ orbit: { left: 180, right: 180 } }, {}),
			anchor
		)
		expect(limits.minAzimuthAngle).toBe(-Infinity)
		expect(limits.maxAzimuthAngle).toBe(Infinity)
	})

	it('passes the scene-wide limits through untouched', () => {
		const limits = orbitLimitsFor(
			resolveCameraConstraints(undefined, {
				minDistance: 1,
				maxDistance: 3,
				minAzimuthAngle: -0.2,
				maxAzimuthAngle: 0.2
			}),
			anchor
		)
		expect(limits).toMatchObject({
			minDistance: 1,
			maxDistance: 3,
			minAzimuthAngle: -0.2,
			maxAzimuthAngle: 0.2
		})
	})

	it('stops a turn to the camera’s right at the right limit, as the controls do', () => {
		// From +Z looking at the origin, the camera's right is +X.
		const position = new Vector3(0, 0, 5)
		const limits = orbitLimitsFor(
			resolveCameraConstraints({ orbit: { left: 0, right: 20 } }, {}),
			orbitAnchor(position, origin, up)
		)
		const turned = new Vector3(
			5 * Math.sin(Math.PI / 6),
			0,
			5 * Math.cos(Math.PI / 6)
		)
		const held = clampToOrbitLimits(turned, origin, up, limits)
		expect(held.x).toBeGreaterThan(0)
		expect(orbitAnchor(held, origin, up).azimuth).toBeCloseTo(20 * RADIANS)
	})
})

describe('orbitAnchor', () => {
	it('reads distance, azimuth and elevation around the target', () => {
		const anchor = orbitAnchor(new Vector3(0, 5, 5), origin, up)
		expect(anchor.distance).toBeCloseTo(Math.SQRT2 * 5)
		expect(anchor.azimuth).toBeCloseTo(0)
		expect(anchor.elevation).toBeCloseTo(45)
	})
})

describe('defaultCameraConstraints', () => {
	it('zooms 2× either way, pans, and tilts from level to 85°', () => {
		expect(defaultCameraConstraints(30)).toEqual({
			zoom: { enabled: true, closer: 2, farther: 2 },
			pan: true,
			tilt: { lowest: 0, highest: 85 }
		})
	})

	it('widens the tilt to take in a camera looking from below or from above', () => {
		expect(defaultCameraConstraints(-12).tilt).toEqual({
			lowest: -12,
			highest: 85
		})
		expect(defaultCameraConstraints(88).tilt).toEqual({
			lowest: 0,
			highest: 88
		})
	})
})
