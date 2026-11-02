/**
 * What `resolveCameraSelection` makes of a stored camera, branch by branch.
 *
 * Characterization: written against the resolver before its math moved into
 * `@vctrl/core`, and kept unchanged after, so the move is shown to change
 * nothing. The cases are the rule as it stood, odd corners included.
 */
import { Euler, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { resolveCameraSelection } from './scene-camera'

import type { CameraConfig } from '@vctrl/core'

const live = () => {
	const camera = new PerspectiveCamera(42, 1.5, 0.1, 100)
	camera.position.set(0, 0, 8)
	return camera
}

const cam = (cameraId: string, rest: Partial<CameraConfig> = {}) =>
	({ cameraId, name: cameraId, ...rest }) as CameraConfig

const resolve = (
	cameras: CameraConfig[] | undefined,
	activeCameraId?: string,
	controlsTarget = new Vector3()
) => resolveCameraSelection(cameras, activeCameraId, controlsTarget, live())

const round = (vector: Vector3 | Euler) =>
	vector
		.toArray()
		.slice(0, 3)
		.map((axis) => Math.round(Number(axis) * 1e6) / 1e6)

describe('which camera is selected', () => {
	const cameras = [
		cam('hotspot-a', { kind: 'hotspot', position: [1, 0, 0] }),
		cam('front', { position: [0, 0, 5] }),
		cam('side', { position: [5, 0, 0], initial: true })
	]

	it('takes the requested camera', () => {
		expect(resolve(cameras, 'front').cameraId).toBe('front')
	})

	it('takes the initial camera when the request names none it has', () => {
		expect(resolve(cameras, 'missing').cameraId).toBe('side')
		expect(resolve(cameras).cameraId).toBe('side')
	})

	it('takes the first scene camera when none is initial', () => {
		const noInitial = cameras.map((entry) => ({ ...entry, initial: false }))
		expect(resolve(noInitial, 'missing').cameraId).toBe('front')
	})

	it('takes the first camera when every camera is a hotspot camera', () => {
		const hotspotsOnly = [
			cam('hotspot-a', { kind: 'hotspot' }),
			cam('hotspot-b', { kind: 'hotspot' })
		]
		expect(resolve(hotspotsOnly, 'missing').cameraId).toBe('hotspot-a')
	})

	it('falls back to the default camera without any cameras', () => {
		const selection = resolve(undefined)
		expect(selection.cameraId).toBe('default')
		expect(selection.targetFov).toBe(60)
		expect(round(selection.targetPosition)).toEqual([0, 0, 8])
	})

	it('falls back to the default camera for an empty list', () => {
		expect(resolve([]).cameraId).toBe('default')
	})
})

describe('the transition', () => {
	it('defaults to a one-second eased linear flight', () => {
		expect(resolve([cam('front')]).transition).toEqual({
			type: 'linear',
			duration: 1000,
			easing: 'ease_in_out'
		})
	})

	it('keeps a scene transition with a type', () => {
		const transition = { type: 'none' as const }
		expect(
			resolveCameraSelection(
				[cam('front')],
				'front',
				new Vector3(),
				live(),
				transition
			).transition
		).toBe(transition)
	})
})

describe('the pose', () => {
	it('takes a stored position and target as they are', () => {
		const selection = resolve([
			cam('front', { position: [1, 2, 3], target: [0, 1, 0], fov: 35 })
		])
		expect(round(selection.targetPosition)).toEqual([1, 2, 3])
		expect(round(selection.targetLookAt)).toEqual([0, 1, 0])
		expect(selection.targetFov).toBe(35)
	})

	it('reads the legacy lookAt as the target', () => {
		const selection = resolve([
			cam('front', {
				position: [1, 2, 3],
				lookAt: [4, 5, 6]
			} as Partial<CameraConfig>)
		])
		expect(round(selection.targetLookAt)).toEqual([4, 5, 6])
	})

	it('prefers target over the legacy lookAt', () => {
		const selection = resolve([
			cam('front', {
				position: [1, 2, 3],
				target: [0, 0, 0],
				lookAt: [4, 5, 6]
			} as Partial<CameraConfig>)
		])
		expect(round(selection.targetLookAt)).toEqual([0, 0, 0])
	})

	it('aims a position-only camera at the live orbit target', () => {
		const selection = resolve(
			[cam('front', { position: [1, 2, 3] })],
			'front',
			new Vector3(7, 7, 7)
		)
		expect(round(selection.targetLookAt)).toEqual([7, 7, 7])
	})

	it('stands a rotation-only camera back from its target by the live orbit radius', () => {
		// Looking down -Z with no rotation; the live camera is 8 from the target.
		const selection = resolve([
			cam('front', { rotation: [0, 0, 0], target: [0, 1, 0] })
		])
		expect(round(selection.targetPosition)).toEqual([0, 1, 8])
		expect(round(selection.targetLookAt)).toEqual([0, 1, 0])
	})

	it('stands a rotation-only camera without a target back from the live one', () => {
		const selection = resolve(
			[cam('front', { rotation: [0, Math.PI / 2, 0] })],
			'front',
			new Vector3(0, 0, 4)
		)
		// Turned to look down -X; the live camera is 4 from the orbit target.
		expect(round(selection.targetPosition)).toEqual([4, 0, 4])
		expect(round(selection.targetLookAt)).toEqual([0, 0, 4])
	})

	it('keeps an orbit radius of at least 1', () => {
		const sceneCamera = live()
		sceneCamera.position.set(0, 0, 0.25)
		const selection = resolveCameraSelection(
			[cam('front', { rotation: [0, 0, 0], target: [0, 0, 0] })],
			'front',
			new Vector3(),
			sceneCamera
		)
		expect(round(selection.targetPosition)).toEqual([0, 0, 1])
	})

	it('aims a camera with a position and rotation along its rotation', () => {
		const selection = resolve([
			cam('front', { position: [0, 0, 10], rotation: [0, 0, 0] })
		])
		// Forward is -Z, at the live orbit radius of 8.
		expect(round(selection.targetLookAt)).toEqual([0, 0, 2])
		expect(round(selection.targetRotation)).toEqual([0, 0, 0])
	})

	it('keeps the live position for a camera with no pose', () => {
		const selection = resolve([cam('front', { fov: 30 })])
		expect(round(selection.targetPosition)).toEqual([0, 0, 8])
		expect(selection.targetFov).toBe(30)
	})

	it('keeps the live field of view when the camera stores none', () => {
		expect(resolve([cam('front', { position: [0, 0, 5] })]).targetFov).toBe(42)
	})

	it('reads a vector stored as an object or a Vector3', () => {
		const selection = resolve([
			cam('front', {
				position: { x: 1, y: 2, z: 3 },
				target: new Vector3(4, 5, 6)
			} as unknown as Partial<CameraConfig>)
		])
		expect(round(selection.targetPosition)).toEqual([1, 2, 3])
		expect(round(selection.targetLookAt)).toEqual([4, 5, 6])
	})

	it('reads a non-numeric axis as 0', () => {
		const selection = resolve([
			cam('front', {
				position: [1, 'x', 3]
			} as unknown as Partial<CameraConfig>)
		])
		expect(round(selection.targetPosition)).toEqual([1, 0, 3])
	})

	it('ignores a vector shorter than three axes', () => {
		const selection = resolve([
			cam('front', { position: [1, 2] } as unknown as Partial<CameraConfig>)
		])
		expect(round(selection.targetPosition)).toEqual([0, 0, 8])
	})
})
