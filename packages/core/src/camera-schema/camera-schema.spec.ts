import { describe, expect, it } from 'vitest'

import {
	cameraFovSchema,
	cameraSettingsSchema,
	cameraTransitionSchema,
	isCameraFov,
	repairCameraEntry
} from '.'

const scene = { cameraId: 'front', name: 'Front' }

describe('cameraFovSchema', () => {
	it.each([1, 60, 179.9])('accepts %s', (fov) => {
		expect(isCameraFov(fov)).toBe(true)
	})

	it.each([0, 180, -1, Number.NaN, Infinity, '60', null])(
		'refuses %s',
		(fov) => {
			expect(cameraFovSchema.safeParse(fov).success).toBe(false)
		}
	)
})

describe('cameraSettingsSchema', () => {
	it('accepts a scene camera and keeps fields it has no rule for', () => {
		const parsed = cameraSettingsSchema.parse({
			cameras: [
				{ ...scene, fov: 50, near: 0.1, position: { x: 1, y: 2, z: 3 } }
			]
		})
		expect(parsed.cameras[0]).toMatchObject({
			fov: 50,
			near: 0.1,
			position: [1, 2, 3]
		})
	})

	it('refuses a list with no scene camera to open on', () => {
		const result = cameraSettingsSchema.safeParse({
			cameras: [{ ...scene, kind: 'hotspot' }]
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]).toMatchObject({
			path: ['cameras'],
			message: 'must contain at least one scene camera'
		})
	})

	it('reads a camera without a kind as a scene camera', () => {
		expect(cameraSettingsSchema.safeParse({ cameras: [scene] }).success).toBe(
			true
		)
	})

	it.each([
		['an fov outside (0, 180)', { fov: 180 }, ['cameras', 0, 'fov']],
		['an unknown kind', { kind: 'drone' }, ['cameras', 0, 'kind']],
		[
			'a vector of the wrong length',
			{ target: [0, 1] },
			['cameras', 0, 'target']
		],
		[
			'a framing aspect of zero',
			{ framingAspect: 0 },
			['cameras', 0, 'framingAspect']
		]
	])('refuses %s, naming where', (_, field, path) => {
		const result = cameraSettingsSchema.safeParse({
			cameras: [{ ...scene, ...field }]
		})
		expect(result.error?.issues[0]?.path).toEqual(path)
	})

	it.each([
		[{ fov: 0 }, 'must be a number of degrees between 0 and 180'],
		[{ fov: '60' }, 'must be a number of degrees between 0 and 180'],
		[{ kind: 'drone' }, "must be 'scene' or 'hotspot'"],
		[{ position: [1, 2] }, 'must be [x, y, z] or {x, y, z} of finite numbers']
	])('says what %o must be, in the words a refusal shows', (field, message) => {
		const result = cameraSettingsSchema.safeParse({
			cameras: [{ ...scene, ...field }]
		})
		expect(result.error?.issues[0]?.message).toBe(message)
	})

	it('refuses an empty list, a malformed transition and a non-boolean switcher', () => {
		expect(cameraSettingsSchema.safeParse({ cameras: [] }).success).toBe(false)
		expect(
			cameraSettingsSchema.safeParse({
				cameras: [scene],
				sceneTransition: { type: 'teleport' }
			}).success
		).toBe(false)
		expect(
			cameraSettingsSchema.safeParse({ cameras: [scene], showControls: 'no' })
				.success
		).toBe(false)
	})
})

describe('repairCameraEntry', () => {
	it('drops each field that fails its rule and names it', () => {
		const { entry, repairs } = repairCameraEntry(
			{ ...scene, fov: -1, kind: 'scene', position: [0, 0, 5] },
			2
		)
		expect(entry).toEqual({ ...scene, kind: 'scene', position: [0, 0, 5] })
		expect(repairs).toEqual([{ cameraIndex: 2, field: 'fov' }])
	})

	it('returns the entry itself when nothing needs repair', () => {
		const stored = { ...scene, fov: 50, position: { x: 0, y: 0, z: 5 } }
		expect(repairCameraEntry(stored, 0).entry).toBe(stored)
	})
})

describe('cameraTransitionSchema', () => {
	it('reads avoidance settings only for the type that uses them', () => {
		const malformed = { samples: 1 }
		expect(
			cameraTransitionSchema.safeParse({
				type: 'linear',
				objectAvoidance: malformed
			}).success
		).toBe(true)
		expect(
			cameraTransitionSchema.safeParse({
				type: 'object_avoidance',
				objectAvoidance: malformed
			}).error?.issues[0]
		).toMatchObject({
			path: ['objectAvoidance', 'samples'],
			message: 'must be a number >= 2'
		})
	})
})
