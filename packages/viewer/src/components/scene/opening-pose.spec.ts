import { describe, expect, it } from 'vitest'

import { withOpeningPose } from './opening-pose'

import type { OpeningPose } from './opening-pose'

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
