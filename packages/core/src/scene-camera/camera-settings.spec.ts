import { describe, expect, it } from 'vitest'

import { isSceneCamera, normalizeCameraSettings } from './camera-settings'

import type { CameraConfig } from '../types'

describe('isSceneCamera', () => {
	it('treats an explicit scene camera and a legacy entry without a kind as scene cameras', () => {
		expect(isSceneCamera({ kind: 'scene' })).toBe(true)
		expect(isSceneCamera({})).toBe(true)
	})

	it('excludes navigational entries', () => {
		expect(isSceneCamera({ kind: 'hotspot' })).toBe(false)
	})
})

describe('normalizeCameraSettings keeps only a usable framingAspect', () => {
	const normalize = (framingAspect: unknown) =>
		normalizeCameraSettings({
			cameras: [
				{ cameraId: 'front', name: 'Front', framingAspect } as CameraConfig
			]
		})?.cameras?.[0]

	it('keeps a valid one', () => {
		expect(normalize(1.25)?.framingAspect).toBe(1.25)
	})

	it.each([0, -1, Number.NaN, Infinity, '1.25', null])(
		'drops %s, so it reads as a camera saved before the field',
		(value) => {
			const camera = normalize(value)
			expect(camera).toBeDefined()
			expect(camera).not.toHaveProperty('framingAspect')
		}
	)

	it('adds nothing to a camera that never had one', () => {
		expect(
			normalizeCameraSettings({
				cameras: [{ cameraId: 'front', name: 'Front' }]
			})?.cameras?.[0]
		).toEqual({ cameraId: 'front', name: 'Front', initial: true })
	})
})
