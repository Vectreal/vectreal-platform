import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { easeFlightProgress, sampleCameraFlight } from './camera-flight'
import { resolveCameraPose } from './camera-pose'
import {
	CameraFraming,
	framingScale,
	isFramingAspect,
	LEGACY_FRAMING_ASPECT,
	MAX_FRAMING_SCALE,
	refitToViewport,
	resolveFramingAspect,
	scaleOrbitDistanceLimits,
	scaleOrbitOffset
} from './viewport-framing'

import type { CameraConfig } from '../types'

const at = (z: number) => ({
	position: new Vector3(0, 0, z),
	target: new Vector3()
})

describe('framingScale', () => {
	it('backs a camera off by how much narrower the viewport is', () => {
		// Framed on a 16:9 desktop, shown on a 4:3 tablet.
		expect(framingScale(16 / 9, 4 / 3)).toBeCloseTo(4 / 3)
	})

	it('keeps the stored distance on a viewport as wide or wider', () => {
		expect(framingScale(1.5, 1.5)).toBe(1)
		expect(framingScale(1.5, 2.4)).toBe(1)
	})

	it('stops at the cap on a very tall, narrow viewport', () => {
		expect(framingScale(16 / 9, 0.1)).toBe(MAX_FRAMING_SCALE)
	})

	it('keeps the stored distance on a viewport with no area yet', () => {
		expect(framingScale(16 / 9, Number.NaN)).toBe(1)
		expect(framingScale(16 / 9, 0)).toBe(1)
		expect(framingScale(16 / 9, Infinity)).toBe(1)
	})
})

describe('isFramingAspect and resolveFramingAspect', () => {
	it('accept a finite, positive width over height', () => {
		expect(isFramingAspect(0.5)).toBe(true)
		expect(resolveFramingAspect(1.25)).toBe(1.25)
	})

	it.each([undefined, null, 0, -1.5, Number.NaN, Infinity, '1.5', [1.5]])(
		'read %s as a camera saved before the aspect was recorded',
		(value) => {
			expect(isFramingAspect(value)).toBe(false)
			expect(resolveFramingAspect(value)).toBe(LEGACY_FRAMING_ASPECT)
		}
	)
})

describe('scaleOrbitOffset and refitToViewport', () => {
	it('moves the position along its line to the target, in place', () => {
		const position = new Vector3(1, 2, 5)
		expect(scaleOrbitOffset(position, new Vector3(1, 2, 1), 2)).toBe(position)
		expect(position.toArray()).toEqual([1, 2, 9])
	})

	it('refits by the change in fit, keeping a visitor’s own zoom in proportion', () => {
		// They zoomed in to 6; narrowing to half the framed aspect doubles it.
		const pose = at(6)
		const framing = { aspect: 2, scale: 1 }
		expect(refitToViewport(pose.position, pose.target, framing, 1)).toBe(true)
		expect(pose.position.z).toBeCloseTo(12)
		expect(framing.scale).toBe(2)
	})

	it('lands where one refit would after a run of them', () => {
		const stepped = at(10)
		const framing = { aspect: 16 / 9, scale: 1 }
		for (const aspect of [1.5, 1.1, 0.8, 0.5625]) {
			refitToViewport(stepped.position, stepped.target, framing, aspect)
		}
		const direct = at(10)
		refitToViewport(
			direct.position,
			direct.target,
			{ aspect: 16 / 9, scale: 1 },
			0.5625
		)
		expect(stepped.position.z).toBeCloseTo(direct.position.z, 10)
	})

	it('returns the camera to its stored distance once the viewport widens', () => {
		const pose = at(10)
		const framing = { aspect: 2, scale: 1 }
		refitToViewport(pose.position, pose.target, framing, 1)
		refitToViewport(pose.position, pose.target, framing, 2.5)
		expect(pose.position.z).toBeCloseTo(10)
	})
})

describe('scaleOrbitDistanceLimits', () => {
	it('scales both limits with the fit, so the zoom range keeps its proportion', () => {
		expect(
			scaleOrbitDistanceLimits({ minDistance: 2, maxDistance: 10 }, 3)
		).toEqual({
			minDistance: 6,
			maxDistance: 30
		})
	})

	it('spans both ends of a flight', () => {
		expect(
			scaleOrbitDistanceLimits({ minDistance: 2, maxDistance: 10 }, 1, 3)
		).toEqual({ minDistance: 2, maxDistance: 30 })
	})

	it('leaves the controls unbounded without host limits', () => {
		expect(scaleOrbitDistanceLimits({}, 2)).toEqual({
			minDistance: 0,
			maxDistance: Infinity
		})
	})
})

describe('resolveCameraPose fits a stored position to the viewport', () => {
	const live = (viewportAspect?: number) => ({
		position: new Vector3(0, 0, 7),
		target: new Vector3(),
		fov: 50,
		viewportAspect
	})
	const camera = (overrides: Partial<CameraConfig> = {}): CameraConfig => ({
		cameraId: 'front',
		name: 'Front',
		fov: 50,
		position: [0, 1, 10],
		target: [0, 1, 0],
		...overrides
	})

	it('backs off along the view on a narrower viewport, keeping the fov', () => {
		const pose = resolveCameraPose(
			[camera({ framingAspect: 2 })],
			'front',
			live(0.5)
		)
		expect(pose.position.toArray()).toEqual([0, 1, 40])
		expect(pose.target.toArray()).toEqual([0, 1, 0])
		expect(pose.fov).toBe(50)
		expect(pose.framing).toEqual({ aspect: 2, scale: 4 })
	})

	it('keeps the stored pose on a wider viewport', () => {
		const pose = resolveCameraPose(
			[camera({ framingAspect: 1 })],
			'front',
			live(2)
		)
		expect(pose.position.toArray()).toEqual([0, 1, 10])
		expect(pose.framing).toEqual({ aspect: 1, scale: 1 })
	})

	it('fits a camera saved before the aspect was recorded as 16:9', () => {
		const pose = resolveCameraPose([camera()], 'front', live(8 / 9))
		expect(pose.framing?.aspect).toBe(LEGACY_FRAMING_ASPECT)
		expect(pose.position.z).toBeCloseTo(20)
	})

	it('returns the stored pose without a viewport, as a capture asks for it', () => {
		const pose = resolveCameraPose(
			[camera({ framingAspect: 2 })],
			'front',
			live()
		)
		expect(pose.position.toArray()).toEqual([0, 1, 10])
		expect(pose.framing).toEqual({ aspect: 2, scale: 1 })
	})

	it('carries no fit for a camera whose position is read off the live one', () => {
		const pose = resolveCameraPose(
			[camera({ position: undefined, framingAspect: 2 })],
			'front',
			live(0.5)
		)
		expect(pose.framing).toBeNull()
		expect(pose.position.toArray()).toEqual([0, 0, 7])
	})
})

describe('CameraFraming', () => {
	it('counts a view nothing fitted as framed at the live aspect, so the address bar collapsing moves it only by the real change', () => {
		// A pose-less opening camera, bounds off, on a phone held upright. The
		// browser's address bar collapses: the canvas grows a little taller.
		const framing = new CameraFraming(0.5)
		framing.show(null)
		const view = at(10)

		framing.refit(0.47, view)

		expect(view.position.z).toBeCloseTo(10 * (0.5 / 0.47))
	})

	it('starts over at the live aspect after a bounds fit', () => {
		const framing = new CameraFraming(1)
		framing.show({ aspect: 2, scale: 2 })
		framing.reset(0.8)
		expect(framing.view).toEqual({ aspect: 0.8, scale: 1 })
	})

	it('keeps the fit in view for a pose read off the live camera', () => {
		const framing = new CameraFraming(1)
		framing.show({ aspect: 2, scale: 2 })
		framing.show(null)
		expect(framing.view).toEqual({ aspect: 2, scale: 2 })
	})

	it('refits both ends of a flight on its own fits', () => {
		const framing = new CameraFraming(2)
		framing.show({ aspect: 2, scale: 1 })
		framing.fly({ aspect: 4, scale: 1 })
		const flight = { from: at(10), to: at(5) }

		expect(framing.refit(1, null, flight)).toBe(true)

		expect(flight.from.position.z).toBeCloseTo(20)
		expect(flight.to.position.z).toBeCloseTo(20)
	})

	it('gives a destination without a fit of its own a copy, not the same object', () => {
		const framing = new CameraFraming(2)
		framing.show({ aspect: 2, scale: 1 })
		framing.fly(null)
		const flight = { from: at(10), to: at(6) }

		framing.refit(1, null, flight)

		expect(flight.from.position.z).toBeCloseTo(20)
		expect(flight.to.position.z).toBeCloseTo(12)
	})

	it('hands the view to the destination when the flight lands', () => {
		const framing = new CameraFraming(1)
		framing.fly({ aspect: 3, scale: 3 })
		framing.land()
		expect(framing.view).toEqual({ aspect: 3, scale: 3 })
		expect(framing.destination).toBeNull()
	})

	it('spans both ends of a flight in its distance limits', () => {
		const framing = new CameraFraming(1)
		framing.fly({ aspect: 3, scale: 3 })
		expect(framing.distanceLimits({ minDistance: 1, maxDistance: 10 })).toEqual(
			{
				minDistance: 1,
				maxDistance: 30
			}
		)
	})

	it('re-fits an interrupted flight from where it was, not from its start', () => {
		// A to B (fit 1 to 3), retargeted half-way to C (fit 1). The live pose
		// sits near B's fit; dropping it would clamp the first frames inward.
		const framing = new CameraFraming(1)
		framing.show({ aspect: 1, scale: 1 })
		framing.fly({ aspect: 3, scale: 3 })
		framing.fly({ aspect: 1, scale: 1 }, 0.5)

		expect(framing.view.scale).toBeCloseTo(2)
		expect(framing.distanceLimits({ maxDistance: 10 }).maxDistance).toBeCloseTo(
			20
		)
	})

	it('keeps the blended fit when a pose with no position of its own interrupts a flight', () => {
		// A to B (fit 1 to 3), stopped half-way by an edit to a camera with no
		// stored pose: the camera stays where the flight left it.
		const framing = new CameraFraming(1)
		framing.fly({ aspect: 3, scale: 3 })
		framing.show(null, 0.5)

		expect(framing.destination).toBeNull()
		expect(framing.view.scale).toBeCloseTo(2)
	})

	it('never clamps a straight flight interrupted mid-way inward', () => {
		// A at the host's maxDistance (fit 1), flown straight to B backed off 3x
		// on the same line. Half-way the camera sits at twice the limit.
		const maxDistance = 10
		const framing = new CameraFraming(1)
		framing.fly({ aspect: 3, scale: 3 })
		const flight = {
			type: 'linear' as const,
			from: { ...at(maxDistance), fov: 50 },
			to: { ...at(3 * maxDistance), fov: 50 }
		}
		const live = sampleCameraFlight(flight, 0.5).position

		framing.show(null, easeFlightProgress(0.5))

		expect(live.z).toBeCloseTo(20)
		expect(
			framing.distanceLimits({ maxDistance }).maxDistance
		).toBeGreaterThanOrEqual(live.z - 1e-9)
	})

	it('keeps an interrupted fit consistent when one end is clamped, so a small resize moves the camera a little', () => {
		// A 2:1 viewport flying from a camera framed narrower than it (scale 1)
		// to one framed at 3 (scale 1.5), interrupted half-way at scale 1.25.
		const framing = new CameraFraming(2)
		framing.show({ aspect: 0.5, scale: 1 })
		framing.fly({ aspect: 3, scale: 1.5 })
		framing.show(null, 0.5)
		const view = at(12.5)

		framing.refit(1.99, view)

		// The view frames the 2.5 width on screen: 0.5% narrower, 0.5% farther.
		expect(framing.view.scale).toBeCloseTo(2.5 / 1.99)
		expect(view.position.z).toBeCloseTo((12.5 * 2.5) / 1.99 / 1.25)
	})

	it('frames an interrupted fit at the viewport as it is after a resize', () => {
		// Opened on a 2:1 desktop, the window narrowed to 1:1, then a flight
		// from fit 2 to fit 3 is interrupted half-way.
		const framing = new CameraFraming(2)
		framing.refit(1, at(10))
		framing.fly({ aspect: 3, scale: 3 })
		framing.show(null, 0.5)

		expect(framing.view).toEqual({ aspect: 2.5, scale: 2.5 })
	})

	it('moves the interrupted start with the viewport from its blended fit', () => {
		const framing = new CameraFraming(1)
		framing.fly({ aspect: 3, scale: 3 })
		framing.fly({ aspect: 1, scale: 1 }, 0.5)
		const flight = { from: at(10), to: at(10) }

		framing.refit(0.5, null, flight)

		// The blend was framed so this viewport reads it as 2; half as wide doubles it.
		expect(flight.from.position.z).toBeCloseTo(20)
	})

	it('stores a pose captured on a phone so a desktop shows it as framed', () => {
		// A 16:9 camera shown on a phone held upright is backed off 3.6x. The
		// author captures that view; on a desktop it must come back as stored.
		const stored = [0, 1, 10] as [number, number, number]
		const live = { position: new Vector3(), target: new Vector3(), fov: 50 }
		const cameras: CameraConfig[] = [
			{ cameraId: 'hero', name: 'Hero', position: stored, target: [0, 1, 0] }
		]
		const phone = resolveCameraPose(cameras, 'hero', {
			...live,
			viewportAspect: 0.4625
		})
		const framing = new CameraFraming(0.4625)
		framing.show(phone.framing)

		const captured = framing.storedPose(phone.position, phone.target, 0.4625)
		const desktop = resolveCameraPose(
			[
				{
					...cameras[0],
					position: captured.position.toArray(),
					framingAspect: captured.framingAspect
				}
			],
			'hero',
			{ ...live, viewportAspect: 16 / 9 }
		)

		expect(captured.framingAspect).toBeCloseTo(LEGACY_FRAMING_ASPECT)
		expect(
			desktop.position.toArray().map((axis) => Math.round(axis * 1e6) / 1e6)
		).toEqual(stored)
	})

	it('stores a view nothing fitted at the live aspect, as it stands', () => {
		const framing = new CameraFraming(1.2)
		const view = at(7)
		expect(framing.storedPose(view.position, view.target, 1.2)).toEqual({
			position: new Vector3(0, 0, 7),
			framingAspect: 1.2
		})
		expect(view.position.z).toBe(7)
	})

	it('stores the width framed on a viewport wider than the camera’s own aspect', () => {
		// A 16:9 camera on a 2:1 desktop sits at scale 1, so the screen shows a
		// 2:1 width. Stored as 16:9, a 16:9 viewport would crop what was framed.
		const framing = new CameraFraming(2)
		framing.show({ aspect: 16 / 9, scale: 1 })
		const view = at(8)

		expect(framing.storedPose(view.position, view.target, 2)).toEqual({
			position: new Vector3(0, 0, 8),
			framingAspect: 2
		})
	})

	it('stores a pose captured mid-flight at the fit between the two ends', () => {
		const framing = new CameraFraming(1)
		framing.fly({ aspect: 4, scale: 4 })
		const view = at(25)

		const stored = framing.storedPose(view.position, view.target, 1, 0.5)

		// Half-way between fits of 1 and 4 is 2.5.
		expect(stored.position.z).toBeCloseTo(10)
		expect(stored.framingAspect).toBeCloseTo(2.5)
	})

	it('keeps the cameras’ own aspects through an interruption, so a viewport neither needs a fit for moves nothing', () => {
		// Two 16:9 cameras on a 2:1 desktop, both at scale 1. Narrowing to 16:9
		// needs no back-off for either, mid-flight or not.
		const framing = new CameraFraming(2)
		framing.show({ aspect: 16 / 9, scale: 1 })
		framing.fly({ aspect: 16 / 9, scale: 1 })
		framing.fly(null, 0.5)
		const flight = { from: at(10), to: at(10) }

		expect(framing.refit(16 / 9, null, flight)).toBe(false)
		expect(flight.from.position.z).toBe(10)
	})
})
