import { describe, expect, it } from 'vitest'

import {
	cameraElevation,
	cameraLimits,
	describeCameraLimits,
	withElevationInTilt
} from './camera-limits'

describe('cameraLimits', () => {
	it('is the camera’s own limits when it has them', () => {
		const constraints = { pan: false }
		expect(cameraLimits({ cameraId: 'a', name: 'A', constraints }, {})).toBe(
			constraints
		)
	})

	it('is what the scene-wide controls give a camera without them', () => {
		expect(
			cameraLimits(
				{ cameraId: 'a', name: 'A' },
				{ enableZoom: false, maxPolarAngle: Math.PI / 2 }
			)
		).toEqual({
			zoom: { enabled: false },
			pan: true,
			tilt: { lowest: 0, highest: 90 }
		})
	})
})

describe('cameraLimits from older scenes', () => {
	it('rounds the scene-wide angles outward, so no reachable angle is lost', () => {
		expect(
			cameraLimits(
				{ cameraId: 'a', name: 'A' },
				{ maxPolarAngle: 1, minPolarAngle: 0.3 }
			).tilt
		).toEqual({ lowest: 32, highest: 73 })
	})

	it('holds stored angles to what a save accepts', () => {
		expect(
			cameraLimits(
				{ cameraId: 'a', name: 'A' },
				{ maxPolarAngle: 4, minPolarAngle: 3.5 }
			).tilt
		).toEqual({ lowest: -90, highest: -90 })
	})
})

describe('withElevationInTilt', () => {
	it('widens the range to take in the elevation', () => {
		expect(
			withElevationInTilt({ tilt: { lowest: 0, highest: 85 } }, -12.4).tilt
		).toEqual({ lowest: -13, highest: 85 })
		expect(
			withElevationInTilt({ tilt: { lowest: 0, highest: 85 } }, 88.2).tilt
		).toEqual({ lowest: 0, highest: 89 })
	})

	it('returns limits that already take it in as they are', () => {
		const limits = { tilt: { lowest: 0, highest: 85 } }
		expect(withElevationInTilt(limits, 30)).toBe(limits)
	})
})

describe('cameraElevation', () => {
	it('reads the elevation of the saved pose, level without one', () => {
		expect(
			cameraElevation({
				cameraId: 'a',
				name: 'A',
				position: [0, 5, 5],
				target: [0, 0, 0]
			})
		).toBeCloseTo(45)
		expect(cameraElevation({ cameraId: 'a', name: 'A' })).toBe(0)
	})

	it('reads an older camera’s lookAt as its target', () => {
		expect(
			cameraElevation({
				cameraId: 'a',
				name: 'A',
				position: [0, 5, 5],
				lookAt: [0, 5, 0]
			} as never)
		).toBeCloseTo(0)
	})

	it('aims a hotspot camera saved without a target at its hotspot', () => {
		expect(
			cameraElevation(
				{ cameraId: 'h', name: 'H', kind: 'hotspot', position: [0, 5, 5] },
				[{ linkedCameraId: 'h', worldPosition: [0, 5, 0] } as never]
			)
		).toBeCloseTo(0)
	})
})

describe('describeCameraLimits', () => {
	it('names what a visitor can do', () => {
		expect(
			describeCameraLimits({
				zoom: { enabled: false },
				pan: true,
				orbit: { left: 30, right: 45 }
			})
		).toBe('No zoom, pan, 30° / 45°')
	})
})
