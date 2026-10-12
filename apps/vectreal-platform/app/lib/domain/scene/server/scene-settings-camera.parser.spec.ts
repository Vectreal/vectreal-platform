import { SceneSettingsParser } from './scene-settings.parser.server'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * The author's camera-switcher choice on the save path.
 *
 * The viewer hides its switcher only for a literal `false`, and the parser
 * spreads the camera block into the stored settings, so a string `'false'`
 * would be saved and later read as shown: the author's off turned into an on
 * with nothing saying so.
 */

const CAMERAS = [
	{ cameraId: 'hero', name: 'Hero', kind: 'scene' },
	{ cameraId: 'detail', name: 'Detail', kind: 'scene' }
]

const parse = (camera: Record<string, unknown>) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'update',
		sceneId: '33333333-3333-4333-8333-333333333333',
		settings: { camera: { cameras: CAMERAS, ...camera } }
	})

const parsedCamera = (result: unknown) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	const { settings } = result as SceneSettingsRequest
	if (!settings?.camera) throw new Error('the parser returned no camera')
	return settings.camera
}

describe('the camera switcher setting on the save path', () => {
	it('carries an author’s explicit choice through, either way', () => {
		expect(parsedCamera(parse({ showControls: false })).showControls).toBe(
			false
		)
		expect(parsedCamera(parse({ showControls: true })).showControls).toBe(true)
	})

	it('leaves the setting absent when the author never made one', () => {
		expect(parsedCamera(parse({})).showControls).toBeUndefined()
	})

	it('refuses a non-boolean rather than store it as a choice', async () => {
		const result = parse({ showControls: 'false' })
		expect(result).toBeInstanceOf(Response)
		expect((result as Response).status).toBe(400)
		expect(await (result as Response).text()).toContain(
			'camera.showControls must be a boolean'
		)
	})
})
