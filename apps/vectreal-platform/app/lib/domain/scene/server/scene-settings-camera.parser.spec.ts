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

describe('a camera pose on the save path', () => {
	const withCamera = (camera: Record<string, unknown>) =>
		parse({ cameras: [{ ...CAMERAS[0], ...camera }] })

	it('keeps a field of view the lens can draw', () => {
		const [hero] = parsedCamera(withCamera({ fov: 35 })).cameras ?? []
		expect(hero.fov).toBe(35)
	})

	it.each([0, 180, -10, 500, '45'])(
		'refuses a field of view of %j',
		async (fov) => {
			const result = withCamera({ fov })
			expect(result).toBeInstanceOf(Response)
			expect(await (result as Response).text()).toContain(
				'camera.cameras[0].fov must be a number of degrees between 0 and 180'
			)
		}
	)

	it('refuses a kind the viewer does not know', async () => {
		const result = withCamera({ kind: 'overview' })
		expect(result).toBeInstanceOf(Response)
		expect(await (result as Response).text()).toContain(
			"camera.cameras[0].kind must be 'scene' or 'hotspot'"
		)
	})
})

describe('the camera list on the save path', () => {
	it('refuses a list with no scene camera for the scene to open on', async () => {
		const result = parse({
			cameras: [{ cameraId: 'pin', name: 'Pin', kind: 'hotspot' }]
		})
		expect(result).toBeInstanceOf(Response)
		expect(await (result as Response).text()).toContain(
			'camera.cameras must contain at least one scene camera'
		)
	})

	it('names only the path for a camera without a name', async () => {
		const result = parse({ cameras: [{ cameraId: 'hero', fov: 0 }] })
		expect(await (result as Response).text()).toContain('between 0 and 180"')
	})
})

describe('camera vectors on the save path', () => {
	const withCamera = (camera: Record<string, unknown>) =>
		parse({ cameras: [{ ...CAMERAS[0], ...camera }] })

	it.each([
		['a tuple', [1, 2, 3]],
		['an object', { x: 1, y: 2, z: 3 }]
	])(
		'stores position, target and rotation sent as %s as [x, y, z]',
		(_form, vector) => {
			const [hero] =
				parsedCamera(
					withCamera({ position: vector, target: vector, rotation: vector })
				).cameras ?? []

			expect(hero.position).toEqual([1, 2, 3])
			expect(hero.target).toEqual([1, 2, 3])
			expect(hero.rotation).toEqual([1, 2, 3])
		}
	)

	it.each([
		['position', [1, 2]],
		['target', { x: 1, y: 2 }],
		['rotation', [0, 0, 0, 'XYZ']],
		['position', ['1', 2, 3]],
		['target', [1, Infinity, 3]],
		['position', null]
	])(
		'refuses a %s of %j, naming the camera and the field',
		async (field, value) => {
			const result = withCamera({ [field]: value })

			expect(result).toBeInstanceOf(Response)
			expect(await (result as Response).text()).toContain(
				`camera.cameras[0].${field} must be [x, y, z] or {x, y, z} of finite numbers (camera \\"Hero\\")`
			)
		}
	)
})
