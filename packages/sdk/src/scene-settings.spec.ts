import { describe, expect, it } from 'vitest'

import { updateSceneSettingsInputSchema } from './scene-settings'

const hero = { cameraId: 'hero', name: 'Hero' }

describe('updateSceneSettingsInputSchema camera', () => {
	it('takes a camera section the server would store, keeping props it has no rule for', () => {
		const camera = { cameras: [{ ...hero, fov: 35, near: 0.1 }] }
		expect(updateSceneSettingsInputSchema.parse({ camera }).camera).toEqual(
			camera
		)
	})

	it.each([
		['a field of view the lens cannot draw', [{ ...hero, fov: 180 }]],
		['no scene camera to open on', [{ ...hero, kind: 'hotspot' }]],
		['a vector that is not [x, y, z]', [{ ...hero, position: [0, 5] }]],
		['no cameras at all', []]
	])('refuses %s before it is sent', (_case, cameras) => {
		expect(
			updateSceneSettingsInputSchema.safeParse({ camera: { cameras } }).success
		).toBe(false)
	})
})
