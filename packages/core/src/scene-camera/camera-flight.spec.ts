import { Sphere, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
	easeFlightProgress,
	sampleCameraFlight,
	SMART_FLIGHT_CLEARANCE,
	type CameraFlight,
	type CameraFlightFrame
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
		expect(frame.fov).toBeCloseTo(50, 12)
	})
})

describe('lens', () => {
	const halfWidth = (fov: number) => Math.tan((fov * Math.PI) / 360)
	/** The height framed at the target: what the eye reads as zoom. */
	const framedHeight = (frame: CameraFlightFrame) =>
		frame.position.distanceTo(frame.target) * halfWidth(frame.fov)

	/** A narrow lens far out front to a wide one close at the side, as reported. */
	const narrowToWide: CameraFlight = {
		type: 'object_avoidance',
		from: pose([0, 0.6, 5.5], [0, 0, 0], 30),
		to: pose([2.2, 0.6, 0], [0, 0, 0], 70),
		easing: 'ease_in_out',
		bounds: unitModel
	}
	/** Two cameras framing the same height with different lenses: a dolly zoom. */
	const dollyZoom: CameraFlight = {
		type: 'object_avoidance',
		from: pose([0, 0, 1.2 / halfWidth(30)], [0, 0, 0], 30),
		to: pose([0, 0, 1.2 / halfWidth(70)], [0, 0, 0], 70),
		easing: 'ease_in_out',
		bounds: unitModel
	}

	const sampled = (flight: CameraFlight, count = 120) =>
		Array.from({ length: count + 1 }, (_, index) =>
			sampleCameraFlight(flight, index / count)
		)

	it("lands on each end's stored lens exactly", () => {
		expect(sampleCameraFlight(narrowToWide, 0).fov).toBe(30)
		expect(sampleCameraFlight(narrowToWide, 1).fov).toBe(70)
	})

	it('zooms by equal ratios in equal time', () => {
		const flight = {
			...narrowToWide,
			type: 'linear' as const,
			easing: 'linear' as const
		}
		const ratio = halfWidth(70) / halfWidth(30)
		for (const t of [0.25, 0.5, 0.75]) {
			expect(halfWidth(sampleCameraFlight(flight, t).fov)).toBeCloseTo(
				halfWidth(30) * Math.pow(ratio, t),
				12
			)
		}
	})

	it.each(EASINGS)('never turns the lens back mid-flight (%s)', (easing) => {
		for (const type of ['object_avoidance', 'linear'] as const) {
			const fovs = sampled({ ...narrowToWide, type, easing }).map(
				({ fov }) => fov
			)
			for (let i = 1; i < fovs.length; i++) {
				expect(fovs[i]).toBeGreaterThanOrEqual(fovs[i - 1])
			}
		}
	})

	it.each(EASINGS)(
		"moves Smart's framed size one way, never past either end (%s)",
		(easing) => {
			for (const flight of [narrowToWide, dollyZoom]) {
				const heights = sampled({ ...flight, easing }).map(framedHeight)
				const [first, last] = [heights[0], heights[heights.length - 1]]
				const direction = Math.sign(last - first)
				for (let i = 1; i < heights.length; i++) {
					const step = heights[i] - heights[i - 1]
					expect(step * direction).toBeGreaterThanOrEqual(-1e-9)
					expect(heights[i]).toBeGreaterThanOrEqual(
						Math.min(first, last) - 1e-9
					)
					expect(heights[i]).toBeLessThanOrEqual(Math.max(first, last) + 1e-9)
				}
			}
		}
	)
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

describe("Smart's motion where it clears the model", () => {
	/*
	  Flights whose orbit around the target would pass through the model, so
	  the clearance has to bend them. A floor met frame by frame bent each one
	  at the moment of contact, then slid the camera round the model's center.
	*/
	const bending: Record<string, CameraFlight> = {
		'close-ups on opposite sides': {
			type: 'object_avoidance',
			from: pose([0, 0, 1.4], [0, 0, 0.9]),
			to: pose([0, 0, -1.4], [0, 0, -0.9]),
			bounds: unitModel
		},
		'one hotspot side to the other': {
			type: 'object_avoidance',
			from: pose([1.6, 0.5, 0.6], [0.8, 0.2, 0.2]),
			to: pose([-1.5, 0.3, -0.8], [-0.8, 0.1, -0.3]),
			bounds: unitModel
		},
		'the overview into a close-up': intoCloseUp,
		'tight close-ups straddling the center': {
			type: 'object_avoidance',
			from: pose([0, 0, 1.15], [0, 0, 1]),
			to: pose([0, 0, -1.15], [0, 0, -1]),
			bounds: unitModel
		},
		'a far camera into a close-up deep inside the clearance': {
			type: 'object_avoidance',
			from: pose([0.706, -2.82, -0.9836], [-0.5112, -0.4989, 0.7494]),
			to: pose([-0.2325, 0.0436, -0.2331], [-0.824, 0.5584, -0.0724]),
			bounds: unitModel
		},
		// Between two checks this one dips the furthest toward the floor.
		'past the model between two far targets': {
			type: 'object_avoidance',
			from: pose([-1.5273, 0.4825, -0.9281], [-1.0307, 0.2395, -0.6132]),
			to: pose([0.6291, -2.0091, 1.5159], [-0.9452, -1.0139, 0.9808]),
			bounds: unitModel
		},
		'round a target beside the model': {
			type: 'object_avoidance',
			from: pose([2.1213, 0, 0.8787], [0, 0, 3]),
			to: pose([-2.1213, 0, 0.8787], [0, 0, 3]),
			bounds: unitModel
		}
	}
	const cases = Object.entries(bending).flatMap(([name, flight]) =>
		EASINGS.map((easing) => [name, easing, { ...flight, easing }] as const)
	)

	it.each(cases)(
		'changes velocity and acceleration continuously: %s (%s)',
		(_name, _easing, flight) => {
			/*
			  At a step of h, a smooth path's second difference of velocity
			  shrinks with h cubed. A jump in velocity leaves it at the size of
			  the jump, and a jump in acceleration at h squared times it, so
			  either stands out by orders of magnitude against the top speed.
			*/
			const steps = 5000
			const at = (index: number) =>
				sampleCameraFlight(flight, index / steps).position.clone()
			const velocities: Vector3[] = []
			let previous = at(0)
			for (let i = 1; i <= steps; i++) {
				const position = at(i)
				velocities.push(position.clone().sub(previous))
				previous = position
			}
			const topSpeed = Math.max(...velocities.map((v) => v.length()))
			for (let i = 2; i < velocities.length; i++) {
				const change = velocities[i]
					.clone()
					.sub(velocities[i - 1])
					.sub(velocities[i - 1].clone().sub(velocities[i - 2]))
				expect(change.length() / topSpeed).toBeLessThan(1e-4)
			}
		}
	)

	it.each(Object.entries(bending))(
		'never jolts between two frames at 60 fps, eased in and out: %s',
		(_name, flight) => {
			const path = frames({ ...flight, easing: 'ease_in_out' }).map(
				({ position }) => position
			)
			const steps = path.slice(1).map((p, i) => p.clone().sub(path[i]))
			const topStep = Math.max(...steps.map((step) => step.length()))
			for (let i = 2; i < steps.length; i++) {
				// How much the per-frame change in step changed from the last one.
				const jolt = steps[i]
					.clone()
					.sub(steps[i - 1])
					.sub(steps[i - 1].clone().sub(steps[i - 2]))
				expect(jolt.length() / topStep).toBeLessThan(0.03)
			}
		}
	)

	it('orbits the model itself where pulling back from the target would take over 3x', () => {
		// Orbiting the target would need 7x its distance as it crosses the center.
		const flight = bending['tight close-ups straddling the center']
		for (const progress of [0.25, 0.5, 0.75]) {
			expect(
				sampleCameraFlight(flight, progress).position.distanceTo(
					unitModel.center
				)
			).toBeCloseTo(1.15, 9)
		}
	})

	it('keeps a pull-back whose fit lands exactly on the floor', () => {
		// Its binding check comes back a rounding error short of the floor.
		const flight: CameraFlight = {
			type: 'object_avoidance',
			from: pose([-0.2238, 0.3351, -1.0442], [0.3605, 0.4318, -0.3029]),
			to: pose([-1.1796, 0.0556, -0.2001], [-0.6504, 0.2736, -0.4731]),
			bounds: unitModel
		}
		const [fromDistance, toDistance] = [flight.from, flight.to].map(
			({ position }) => position.distanceTo(unitModel.center)
		)
		const middle = sampleCameraFlight(flight, 0.5)
		const plain = sampleCameraFlight({ ...flight, bounds: null }, 0.5)
		// Lifted off the target orbit, not swapped for the orbit round the center.
		expect(middle.position.distanceTo(middle.target)).toBeGreaterThan(
			plain.position.distanceTo(plain.target)
		)
		expect(middle.position.distanceTo(unitModel.center)).not.toBeCloseTo(
			Math.sqrt(fromDistance * toDistance),
			6
		)
	})

	it('flies the plain orbit, untouched, when it never comes near the model', () => {
		for (const progress of [0.1, 0.3, 0.5, 0.7, 0.9]) {
			expect(
				sampleCameraFlight(frontToBack, progress).position.toArray()
			).toEqual(
				sampleCameraFlight(
					{ ...frontToBack, bounds: null },
					progress
				).position.toArray()
			)
		}
	})

	it.each(Object.entries(bending))(
		'stays outside the model between frames too: %s',
		(_name, flight) => {
			// No deeper than the deeper end, for a close-up inside the clearance.
			const allowed = Math.min(
				unitModel.radius * (1 + SMART_FLIGHT_CLEARANCE),
				flight.from.position.distanceTo(unitModel.center),
				flight.to.position.distanceTo(unitModel.center)
			)
			for (let i = 0; i <= 2000; i++) {
				expect(
					sampleCameraFlight(flight, i / 2000).position.distanceTo(
						unitModel.center
					)
				).toBeGreaterThanOrEqual(allowed - 1e-9)
			}
		}
	)
})
