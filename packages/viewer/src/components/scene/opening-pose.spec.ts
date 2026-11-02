import { withOpeningPose } from '@vctrl/core/scene-camera'
import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { resolveCameraSelection } from './scene-camera'

import type { OpeningPose } from '@vctrl/core/scene-camera'

const opening: OpeningPose = {
	cameraId: 'default',
	position: [0, 3.5, 23.6],
	target: [0, 3.5, 0]
}

describe('withOpeningPose', () => {
	it('stands a camera with no pose where the viewer framed it at load', () => {
		// A scene saved before the opening view was recorded: a field of view only.
		expect(
			withOpeningPose(
				{ cameraId: 'default', name: 'Default', fov: 60 },
				opening
			)
		).toEqual({
			cameraId: 'default',
			name: 'Default',
			fov: 60,
			position: [0, 3.5, 23.6],
			target: [0, 3.5, 0]
		})
	})

	it.each([
		['a position', { position: [1, 2, 3] as [number, number, number] }],
		['a rotation', { rotation: [0, 1, 0] as [number, number, number] }],
		['a target', { target: [1, 1, 1] as [number, number, number] }],
		['a legacy lookAt', { lookAt: [1, 1, 1] }]
	])('leaves a camera that carries %s alone', (_label, pose) => {
		const camera = { cameraId: 'default', name: 'Default', ...pose }

		expect(withOpeningPose(camera, opening)).toBe(camera)
	})

	it('leaves any other camera with no pose alone', () => {
		// A hotspot camera saved before it had a viewpoint keeps meaning
		// "stay here and look at the marker".
		const camera = { cameraId: 'hotspot-camera-1', name: 'Knob' }

		expect(withOpeningPose(camera, opening)).toBe(camera)
	})

	it('changes nothing before the viewer has framed the scene', () => {
		const camera = { cameraId: 'default', name: 'Default' }

		expect(withOpeningPose(camera, null)).toBe(camera)
	})
})

/*
  The resolver the viewer flies with and a capture renders from. A screenshot
  of the default camera has to land where the viewer stands it, or a scene with
  a pose-less default camera saves a thumbnail of wherever the author last
  orbited.
*/
describe('resolveCameraSelection with the opening pose', () => {
	const live = () => {
		const camera = new PerspectiveCamera(50, 1, 0.1, 100)
		camera.position.set(9, 9, 9)
		return camera
	}
	const cameras = [{ cameraId: 'default', name: 'Default', fov: 60 }]

	it('stands a pose-less camera where the scene opened', () => {
		const selection = resolveCameraSelection(
			cameras,
			'default',
			new Vector3(),
			live(),
			undefined,
			opening
		)

		expect(selection.targetPosition.toArray()).toEqual([0, 3.5, 23.6])
		expect(selection.targetLookAt.toArray()).toEqual([0, 3.5, 0])
	})

	it('keeps the live position without one', () => {
		const selection = resolveCameraSelection(
			cameras,
			'default',
			new Vector3(),
			live()
		)

		expect(selection.targetPosition.toArray()).toEqual([9, 9, 9])
	})
})
