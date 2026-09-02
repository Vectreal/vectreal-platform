import { describe, expect, it } from 'vitest'

import {
	clipNear,
	fogOpacity,
	projectCameraSpace,
	sortByDepth,
	toCameraSpace
} from './projection'

import type { Camera, DepthSegment, Viewport } from './projection'

const CAMERA: Camera = {
	position: { x: 0, y: 3.4, z: 2.0 },
	yaw: 0,
	pitch: 0.2,
	fov: 54,
	near: 3.5
}

const VIEWPORT: Viewport = { width: 1200, height: 480 }

describe('toCameraSpace', () => {
	it('puts a point straight ahead of an unrotated camera on the -z axis', () => {
		const camera: Camera = { ...CAMERA, pitch: 0 }
		const result = toCameraSpace({ x: 0, y: 3.4, z: -48 }, camera)

		expect(result.x).toBeCloseTo(0, 6)
		expect(result.y).toBeCloseTo(0, 6)
		expect(result.z).toBeCloseTo(-50, 6)
	})
})

describe('clipNear', () => {
	it('returns null when both endpoints are behind the near plane', () => {
		const a = { x: 0, y: 0, z: -1 }
		const b = { x: 1, y: 0, z: -2 }
		expect(clipNear(a, b, 3.5)).toBeNull()
	})

	it('returns the segment untouched when both endpoints are ahead', () => {
		const a = { x: 0, y: 0, z: -10 }
		const b = { x: 1, y: 0, z: -20 }
		expect(clipNear(a, b, 3.5)).toEqual([a, b])
	})

	it('moves the near endpoint onto the near plane when the segment straddles it', () => {
		const clipped = clipNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -11 }, 3.5)

		expect(clipped).not.toBeNull()
		expect(-clipped![0].z).toBeCloseTo(3.5, 6)
		expect(clipped![1].z).toBeCloseTo(-11, 6)
	})

	it('clips the second endpoint when it is the one behind', () => {
		const clipped = clipNear({ x: 0, y: 0, z: -11 }, { x: 0, y: 0, z: -1 }, 3.5)

		expect(clipped).not.toBeNull()
		expect(clipped![0].z).toBeCloseTo(-11, 6)
		expect(-clipped![1].z).toBeCloseTo(3.5, 6)
	})
})

describe('projectCameraSpace', () => {
	it('projects a point on the view axis to the centre of the viewport', () => {
		const point = projectCameraSpace({ x: 0, y: 0, z: -20 }, CAMERA, VIEWPORT)

		expect(point.x).toBeCloseTo(600, 6)
		expect(point.y).toBeCloseTo(240, 6)
		expect(point.depth).toBeCloseTo(20, 6)
	})

	it('raises the horizon up the frame under positive pitch', () => {
		// Guards the convention: positive pitch tilts the camera DOWN, which puts
		// distant geometry HIGHER in screen space (smaller y, since y grows
		// downward). Getting this backwards cost several prototype iterations.
		const distant = { x: 0, y: CAMERA.position.y, z: CAMERA.position.z - 400 }

		const level = projectCameraSpace(
			toCameraSpace(distant, { ...CAMERA, pitch: 0 }),
			CAMERA,
			VIEWPORT
		)
		const pitched = projectCameraSpace(
			toCameraSpace(distant, CAMERA),
			CAMERA,
			VIEWPORT
		)

		expect(pitched.y).toBeLessThan(level.y)
	})
})

describe('fogOpacity', () => {
	const fog = { near: 4, far: 62, power: 0.85 }

	it('is fully opaque at or before the fog near distance', () => {
		expect(fogOpacity(2, fog)).toBe(1)
		expect(fogOpacity(4, fog)).toBe(1)
	})

	it('is fully transparent at or beyond the fog far distance', () => {
		expect(fogOpacity(62, fog)).toBe(0)
		expect(fogOpacity(500, fog)).toBe(0)
	})

	it('decreases monotonically with depth', () => {
		expect(fogOpacity(10, fog)).toBeGreaterThan(fogOpacity(30, fog))
		expect(fogOpacity(30, fog)).toBeGreaterThan(fogOpacity(50, fog))
	})
})

describe('sortByDepth', () => {
	it('orders far segments first so nearer strokes paint over them', () => {
		const make = (depth: number): DepthSegment => ({
			x1: 0,
			y1: 0,
			x2: 1,
			y2: 1,
			opacity: 1,
			width: 0.55,
			accent: false,
			depth
		})

		const sorted = sortByDepth([make(5), make(40), make(20)])
		expect(sorted.map((segment) => segment.depth)).toEqual([40, 20, 5])
	})

	it('does not mutate its input', () => {
		const segments: DepthSegment[] = [
			{
				x1: 0,
				y1: 0,
				x2: 1,
				y2: 1,
				opacity: 1,
				width: 0.55,
				accent: false,
				depth: 5
			},
			{
				x1: 0,
				y1: 0,
				x2: 1,
				y2: 1,
				opacity: 1,
				width: 0.55,
				accent: false,
				depth: 40
			}
		]

		sortByDepth(segments)
		expect(segments[0].depth).toBe(5)
	})
})
