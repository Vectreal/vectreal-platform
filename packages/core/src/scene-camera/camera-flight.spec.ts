import { Sphere, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
	easeFlightProgress,
	sampleCameraFlight,
	SMART_FLIGHT_CLEARANCE,
	type CameraFlight
} from './camera-flight'

import type { CameraTransitionEasing } from '../types'

const EASINGS: CameraTransitionEasing[] = [
	'linear',
	'ease_in',
	'ease_out',
	'ease_in_out'
]

const pose = (
	position: [number, number, number],
	target: [number, number, number] = [0, 0, 0],
	fov = 50
) => ({
	position: new Vector3(...position),
	target: new Vector3(...target),
	fov
})

const unitModel = new Sphere(new Vector3(0, 0, 0), 1)

/** Front of the model to straight behind it: the path most likely to cut through. */
const frontToBack: CameraFlight = {
	type: 'object_avoidance',
	from: pose([0, 0.3, 3]),
	to: pose([0, 0.3, -3]),
	easing: 'ease_in_out',
	bounds: unitModel
}

/** The scene view into a hotspot close-up on the same side, inside the sphere. */
const intoCloseUp: CameraFlight = {
	type: 'object_avoidance',
	from: pose([0.5, 0.8, 3]),
	to: pose([0.15, 0.2, 0.75], [0.1, 0.1, 0.45]),
	easing: 'ease_in_out',
	bounds: unitModel
}

/** One flight at 60 fps over `durationMs`, as the viewer would render it. */
const frames = (flight: CameraFlight, durationMs = 1000, fps = 60) => {
	const count = Math.round((durationMs / 1000) * fps)
	return Array.from({ length: count + 1 }, (_, index) => {
		const frame = sampleCameraFlight(flight, index / count)
		return { position: frame.position.clone(), target: frame.target.clone() }
	})
}

describe('easeFlightProgress', () => {
	it.each(EASINGS)('%s starts at 0 and ends at 1', (easing) => {
		expect(easeFlightProgress(0, easing)).toBe(0)
		expect(easeFlightProgress(1, easing)).toBe(1)
	})

	it.each(EASINGS)('%s never runs backwards', (easing) => {
		let previous = 0
		for (let i = 1; i <= 200; i++) {
			const value = easeFlightProgress(i / 200, easing)
			expect(value).toBeGreaterThan(previous)
			previous = value
		}
	})

	it('clamps progress outside 0 to 1', () => {
		expect(easeFlightProgress(-0.5, 'ease_in_out')).toBe(0)
		expect(easeFlightProgress(1.5, 'ease_in_out')).toBe(1)
	})

	it('ease_in_out changes acceleration continuously through the midpoint', () => {
		const h = 1e-3
		const acceleration = (t: number) =>
			(easeFlightProgress(t + h, 'ease_in_out') -
				2 * easeFlightProgress(t, 'ease_in_out') +
				easeFlightProgress(t - h, 'ease_in_out')) /
			(h * h)
		expect(
			Math.abs(acceleration(0.5 - 2 * h) - acceleration(0.5 + 2 * h))
		).toBeLessThan(0.5) // the quadratic in-out it replaced jumps by 8
	})
})

describe('sampleCameraFlight', () => {
	describe.each(['linear', 'object_avoidance'] as const)('%s', (type) => {
		const flight = { ...intoCloseUp, type }

		it('lands exactly on both ends', () => {
			const start = sampleCameraFlight(flight, 0)
			const end = sampleCameraFlight(flight, 1)
			expect(start.position.toArray()).toEqual(flight.from.position.toArray())
			expect(start.target.toArray()).toEqual(flight.from.target.toArray())
			expect(end.position.toArray()).toEqual(flight.to.position.toArray())
			expect(end.target.toArray()).toEqual(flight.to.target.toArray())
		})

		it('arrives without a jump on the last frames', () => {
			const end = sampleCameraFlight(flight, 1).position
			const near = sampleCameraFlight(flight, 0.995).position
			const nearer = sampleCameraFlight(flight, 0.9975).position
			expect(near.distanceTo(end)).toBeLessThan(1e-4)
			expect(nearer.distanceTo(end)).toBeLessThan(near.distanceTo(end))
		})

		it.each([30, 60, 144])('moves on every frame at %i fps', (fps) => {
			const path = frames(flight, 1200, fps)
			for (let i = 1; i < path.length; i++) {
				expect(
					path[i].position.distanceTo(path[i - 1].position)
				).toBeGreaterThan(0)
			}
		})

		it('looks at the target on every frame', () => {
			for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
				const frame = sampleCameraFlight(flight, progress)
				const forward = new Vector3(0, 0, -1).applyQuaternion(frame.quaternion)
				const toTarget = frame.target.clone().sub(frame.position).normalize()
				expect(forward.dot(toTarget)).toBeCloseTo(1, 6)
			}
		})
	})

	it('moves the target linearly with the eased progress', () => {
		const frame = sampleCameraFlight({ ...intoCloseUp, easing: 'linear' }, 0.5)
		expect(frame.target.toArray()).toEqual(
			intoCloseUp.from.target.clone().lerp(intoCloseUp.to.target, 0.5).toArray()
		)
		expect(frame.fov).toBe(50)
	})

	it('interpolates the field of view', () => {
		const frame = sampleCameraFlight(
			{
				type: 'linear',
				from: pose([0, 0, 3], [0, 0, 0], 40),
				to: pose([0, 0, 3], [0, 0, 0], 60),
				easing: 'linear'
			},
			0.25
		)
		expect(frame.fov).toBe(45)
	})
})

describe('Smart', () => {
	const floor = unitModel.radius * (1 + SMART_FLIGHT_CLEARANCE)

	it('never enters the model when both ends are outside it', () => {
		for (const { position } of frames(frontToBack)) {
			expect(position.distanceTo(unitModel.center)).toBeGreaterThanOrEqual(
				floor - 1e-9
			)
		}
	})

	it('goes round the model between close-ups on opposite sides', () => {
		// Orbiting the moving target alone would pass 0.5 from the center.
		const acrossTheModel: CameraFlight = {
			type: 'object_avoidance',
			from: pose([0, 0, 1.4], [0, 0, 0.9]),
			to: pose([0, 0, -1.4], [0, 0, -0.9]),
			easing: 'ease_in_out',
			bounds: unitModel
		}
		for (const { position } of frames(acrossTheModel)) {
			expect(position.distanceTo(unitModel.center)).toBeGreaterThanOrEqual(
				floor - 1e-9
			)
		}
	})

	it('stays outside the model for ends scattered around it', () => {
		// A fixed sequence, so a failure reproduces.
		let seed = 7
		const random = () => {
			seed = (seed * 16807) % 2147483647
			return seed / 2147483647
		}
		const around = () =>
			new Vector3(random() - 0.5, random() - 0.5, random() - 0.5)
				.normalize()
				.multiplyScalar(floor + random() * 4)

		for (let i = 0; i < 50; i++) {
			const flight: CameraFlight = {
				type: 'object_avoidance',
				from: {
					position: around(),
					target: around().multiplyScalar(0.2),
					fov: 50
				},
				to: {
					position: around(),
					target: around().multiplyScalar(0.2),
					fov: 50
				},
				easing: 'ease_in_out',
				bounds: unitModel
			}
			for (const { position } of frames(flight)) {
				expect(position.distanceTo(unitModel.center)).toBeGreaterThanOrEqual(
					floor - 1e-9
				)
			}
		}
	})

	it('goes round the model, not through it, the way a straight line would', () => {
		const middle = sampleCameraFlight(frontToBack, 0.5).position
		const straight = sampleCameraFlight(
			{ ...frontToBack, type: 'linear' },
			0.5
		).position
		expect(straight.length()).toBeLessThan(1)
		expect(middle.length()).toBeGreaterThan(2.9)
	})

	it('flies into a close-up without backing away first', () => {
		const path = frames(intoCloseUp)
		const distances = path.map(({ position, target }) =>
			position.distanceTo(target)
		)
		for (let i = 1; i < distances.length; i++) {
			expect(distances[i]).toBeLessThanOrEqual(distances[i - 1] + 1e-9)
		}
	})

	it('keeps its shape when the model is scaled', () => {
		const scale = 0.01
		const scaled: CameraFlight = {
			...frontToBack,
			from: pose(
				frontToBack.from.position.clone().multiplyScalar(scale).toArray()
			),
			to: pose(frontToBack.to.position.clone().multiplyScalar(scale).toArray()),
			bounds: new Sphere(new Vector3(), unitModel.radius * scale)
		}
		for (const progress of [0.2, 0.5, 0.8]) {
			const small = sampleCameraFlight(scaled, progress).position
			const large = sampleCameraFlight(frontToBack, progress).position
			expect(small.clone().divideScalar(scale).distanceTo(large)).toBeLessThan(
				1e-9
			)
		}
	})

	it('zooms at a constant ratio between two distances on one axis', () => {
		const zoom: CameraFlight = {
			type: 'object_avoidance',
			from: pose([0, 0, 8]),
			to: pose([0, 0, 2]),
			easing: 'linear'
		}
		const quarter = sampleCameraFlight(zoom, 0.25).position.length()
		const half = sampleCameraFlight(zoom, 0.5).position.length()
		expect(half).toBeCloseTo(4, 9)
		expect(8 / quarter).toBeCloseTo(quarter / half, 9)
	})

	it('zooms out of a camera sitting on its target without idling first', () => {
		const flight: CameraFlight = {
			type: 'object_avoidance',
			from: pose([0, 0, 0.5], [0, 0, 0.5]),
			to: pose([0, 0, 5]),
			easing: 'linear'
		}
		const half = sampleCameraFlight(flight, 0.5)
		expect(half.position.distanceTo(half.target)).toBeCloseTo(2.5, 6)
	})

	it('turns the short way round', () => {
		const flight: CameraFlight = {
			type: 'object_avoidance',
			from: pose(
				[Math.sin(3), 0, Math.cos(3)].map((v) => v * 3) as [
					number,
					number,
					number
				]
			),
			to: pose(
				[Math.sin(-3), 0, Math.cos(-3)].map((v) => v * 3) as [
					number,
					number,
					number
				]
			),
			easing: 'linear'
		}
		// From 3 rad to -3 rad is 0.28 rad through the back, not 6 through the front.
		const middle = sampleCameraFlight(flight, 0.5).position
		expect(middle.z).toBeCloseTo(-3, 6)
	})
})
