import { describe, expect, it, vi } from 'vitest'

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
	const onRepair = vi.fn()
	const normalize = (framingAspect: unknown) =>
		normalizeCameraSettings(
			{
				cameras: [
					{ cameraId: 'front', name: 'Front', framingAspect } as CameraConfig
				]
			},
			{ onRepair }
		)?.cameras?.[0]

	it('keeps a valid one', () => {
		expect(normalize(1.25)?.framingAspect).toBe(1.25)
	})

	it.each([0, -1, Number.NaN, Infinity, '1.25', null])(
		'drops %s, so it reads as a camera saved before the field',
		(value) => {
			onRepair.mockClear()
			const camera = normalize(value)
			expect(camera).toBeDefined()
			expect(camera).not.toHaveProperty('framingAspect')
			expect(onRepair).toHaveBeenCalledWith([
				{ cameraIndex: 0, field: 'framingAspect' }
			])
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

describe('normalizeCameraSettings repairs what a stored camera cannot use', () => {
	const normalizeOne = (
		entry: Record<string, unknown>,
		onRepair = vi.fn()
	) => ({
		camera: normalizeCameraSettings(
			{ cameras: [{ cameraId: 'front', name: 'Front', ...entry }] } as never,
			{ onRepair }
		)?.cameras?.[0] as Record<string, unknown> | undefined,
		onRepair
	})

	it.each([0, 180, -10, 400, Number.NaN, '60'])(
		'drops a fov of %s, so the lens keeps its own',
		(fov) => {
			const { camera, onRepair } = normalizeOne({ fov })
			expect(camera).not.toHaveProperty('fov')
			expect(onRepair).toHaveBeenCalledWith([{ cameraIndex: 0, field: 'fov' }])
		}
	)

	it('keeps a fov inside (0, 180) and reports nothing', () => {
		const { camera, onRepair } = normalizeOne({ fov: 35 })
		expect(camera?.['fov']).toBe(35)
		expect(onRepair).not.toHaveBeenCalled()
	})

	it('carries every vector exactly as stored, readable or not', () => {
		// The opening pose and a hotspot camera's aim read any stored vector as
		// "this camera has a pose", so a repair here would move the camera.
		const stored = {
			position: { x: 1, y: 2, z: 3 },
			target: 'origin',
			rotation: [0.1, 0.2, 0.3, 'XYZ'],
			lookAt: [0, 1]
		}
		const { camera, onRepair } = normalizeOne(stored)
		expect(camera).toMatchObject(stored)
		expect(onRepair).not.toHaveBeenCalled()
	})

	it('carries the fields it has no read rule for', () => {
		const stored = { cameraId: 7, near: 0.5 }
		const { camera, onRepair } = normalizeOne(stored)
		expect(camera).toMatchObject(stored)
		expect(onRepair).not.toHaveBeenCalled()
	})

	it.each([
		{ type: 'teleport' },
		{ type: 'linear', duration: -1 },
		{ type: 'object_avoidance', objectAvoidance: { samples: 1 } }
	])('drops a legacy transition the write schema refuses: %o', (transition) => {
		const { camera, onRepair } = normalizeOne({ transition })
		expect(camera).not.toHaveProperty('transition')
		expect(onRepair).toHaveBeenCalledWith([
			{ cameraIndex: 0, field: 'transition' }
		])
	})

	it('keeps a transition the write schema accepts', () => {
		const transition = { type: 'linear', duration: 800, easing: 'ease_out' }
		const { camera, onRepair } = normalizeOne({ transition })
		expect(camera?.['transition']).toEqual(transition)
		expect(onRepair).not.toHaveBeenCalled()
	})

	it('makes the first camera of a list with no scene camera the one it opens on', () => {
		const onRepair = vi.fn()
		const normalized = normalizeCameraSettings(
			{
				cameras: [
					{ cameraId: 'pin-a', name: 'A', kind: 'hotspot', fov: 0 },
					{ cameraId: 'pin-b', name: 'B', kind: 'hotspot' }
				]
			},
			{ onRepair }
		)
		expect(normalized?.activeCameraId).toBe('pin-a')
		expect(normalized?.cameras?.map((c) => [c.kind, c.initial])).toEqual([
			['scene', true],
			['hotspot', false]
		])
		expect(normalized?.cameras?.[0]).not.toHaveProperty('fov')
		expect(onRepair).toHaveBeenCalledWith([
			{ cameraIndex: 0, field: 'fov' },
			{ cameraIndex: 0, field: 'kind' }
		])
	})

	it('warns once per read by default, naming every value it dropped', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		try {
			normalizeCameraSettings({
				cameras: [
					{ cameraId: 'a', name: 'A', fov: 0 },
					{ cameraId: 'b', name: 'B', fov: 200 }
				]
			})
			expect(warn).toHaveBeenCalledOnce()
			expect(warn.mock.calls[0][0]).toContain('cameras[0].fov, cameras[1].fov')
		} finally {
			warn.mockRestore()
		}
	})
})
