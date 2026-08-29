import { describe, expect, it } from 'vitest'

import { cameraSelectionSignature } from './camera-selection-signature'

import type { CameraConfig } from '@vctrl/core'

const camera = (overrides: Partial<CameraConfig> = {}): CameraConfig =>
	({ cameraId: 'cam-a', name: 'A', ...overrides }) as CameraConfig

const sign = (cameras: CameraConfig[], id = 'cam-a') =>
	cameraSelectionSignature(cameras, id, undefined)

describe('cameraSelectionSignature', () => {
	it('is the same for a camera nobody edited', () => {
		const cameras = [
			camera({ position: [0, 1, 2], target: [0, 0, 0], fov: 50 })
		]

		expect(sign(cameras)).toBe(sign(cameras))
	})

	/**
	 * The case the snap came from. A hotspot camera carries a target and no
	 * position, so the resolved pose was completed from the live scene camera -
	 * and the live camera moves on every frame of a flight. Signing stored fields
	 * makes the signature blind to that, which is the whole point: it answers
	 * "did the author change anything", not "where is the camera right now".
	 */
	it('ignores everything about where the camera currently is', () => {
		const hotspotCamera = [camera({ kind: 'hotspot', target: [1, 2, 3] })]
		const before = sign(hotspotCamera)

		// Nothing here is an edit; only the live camera would have moved.
		expect(sign(hotspotCamera)).toBe(before)
		expect(sign([...hotspotCamera])).toBe(before)
	})

	it('changes when the author moves the camera', () => {
		expect(sign([camera({ position: [0, 1, 2] })])).not.toBe(
			sign([camera({ position: [0, 1, 9] })])
		)
	})

	it('changes when the author re-aims it', () => {
		expect(sign([camera({ target: [0, 0, 0] })])).not.toBe(
			sign([camera({ target: [1, 2, 3] })])
		)
	})

	it('changes when the author gives a camera a pose it did not have', () => {
		// Absent fields are signed as null rather than skipped, so this reads as an
		// edit instead of collapsing onto the same string.
		expect(sign([camera()])).not.toBe(sign([camera({ position: [0, 1, 2] })]))
	})

	it('changes when the field of view changes', () => {
		expect(sign([camera({ fov: 50 })])).not.toBe(sign([camera({ fov: 60 })]))
	})

	it('follows the transition it was given', () => {
		const cameras = [camera()]

		expect(
			cameraSelectionSignature(cameras, 'cam-a', { type: 'linear' })
		).not.toBe(cameraSelectionSignature(cameras, 'cam-a', { type: 'none' }))
	})

	it('reads a legacy lookAt as the target', () => {
		expect(sign([camera({ lookAt: [1, 2, 3] } as Partial<CameraConfig>)])).toBe(
			sign([camera({ target: [1, 2, 3] })])
		)
	})

	it('signs a malformed vector as absent rather than as itself', () => {
		// Settings arrive from persisted JSON and from host applications, so a
		// partial vector is expressible; signing it raw would make the signature
		// depend on how it happened to serialize.
		expect(
			sign([
				camera({ position: [1, 2] as unknown as [number, number, number] })
			])
		).toBe(sign([camera()]))
	})

	it('signs a camera that is not in the list at all', () => {
		expect(() => sign([camera()], 'missing')).not.toThrow()
		expect(sign([camera()], 'missing')).toBe(sign([], 'missing'))
	})
})
