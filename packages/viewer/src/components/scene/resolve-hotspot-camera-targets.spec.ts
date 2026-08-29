import { describe, expect, it } from 'vitest'

import { resolveHotspotCameraTargets } from './resolve-hotspot-camera-targets'

import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const hotspot = (
	overrides: Partial<HotspotDefinition> & Pick<HotspotDefinition, 'id'>
): HotspotDefinition => ({
	name: overrides.id,
	worldPosition: [1, 2, 3],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const camera = (overrides: Partial<CameraConfig> = {}): CameraConfig =>
	({
		cameraId: 'cam-1',
		name: 'Cam',
		kind: 'hotspot',
		...overrides
	}) as CameraConfig

describe('resolveHotspotCameraTargets', () => {
	it('aims a hotspot camera at its hotspot', () => {
		const result = resolveHotspotCameraTargets(
			[camera()],
			[hotspot({ id: 'h1', linkedCameraId: 'cam-1', worldPosition: [1, 2, 3] })]
		)

		expect(result?.[0].target).toEqual([1, 2, 3])
	})

	it('leaves a target the author set by hand', () => {
		const result = resolveHotspotCameraTargets(
			[camera({ target: [9, 9, 9] })],
			[hotspot({ id: 'h1', linkedCameraId: 'cam-1', worldPosition: [1, 2, 3] })]
		)

		expect(result?.[0].target).toEqual([9, 9, 9])
	})

	it('leaves a legacy lookAt alone too', () => {
		const result = resolveHotspotCameraTargets(
			[camera({ lookAt: [9, 9, 9] } as Partial<CameraConfig>)],
			[hotspot({ id: 'h1', linkedCameraId: 'cam-1', worldPosition: [1, 2, 3] })]
		)

		expect(result?.[0].target).toBeUndefined()
	})

	it('never re-aims a camera the author composed', () => {
		// A hotspot may link the opening frame or another hotspot's camera, and
		// turning that viewpoint to face a marker is an edit nobody asked for.
		const result = resolveHotspotCameraTargets(
			[camera({ kind: 'scene' })],
			[hotspot({ id: 'h1', linkedCameraId: 'cam-1' })]
		)

		expect(result?.[0].target).toBeUndefined()
	})

	it('leaves the position alone, so only the aim changes', () => {
		const result = resolveHotspotCameraTargets(
			[camera()],
			[hotspot({ id: 'h1', linkedCameraId: 'cam-1' })]
		)

		expect(result?.[0].position).toBeUndefined()
	})

	it('resolves a camera two hotspots share the same way every time', () => {
		const cameras = [camera()]
		const first = resolveHotspotCameraTargets(cameras, [
			hotspot({ id: 'a', linkedCameraId: 'cam-1', worldPosition: [1, 1, 1] }),
			hotspot({ id: 'b', linkedCameraId: 'cam-1', worldPosition: [2, 2, 2] })
		])

		expect(first?.[0].target).toEqual([1, 1, 1])
	})

	it('ignores a hotspot whose position is malformed', () => {
		const result = resolveHotspotCameraTargets(
			[camera()],
			[
				{
					...hotspot({ id: 'h1', linkedCameraId: 'cam-1' }),
					worldPosition: [Number.NaN, 0, 0]
				}
			]
		)

		expect(result?.[0].target).toBeUndefined()
	})

	it('hands back the very same array when nothing needed aiming', () => {
		// The publisher memoizes its camera options on identity, so a fresh array
		// every render would re-register the viewer's capture callbacks.
		const cameras = [camera({ target: [9, 9, 9] })]

		expect(resolveHotspotCameraTargets(cameras, [hotspot({ id: 'h1' })])).toBe(
			cameras
		)
		expect(resolveHotspotCameraTargets(cameras, undefined)).toBe(cameras)
		expect(resolveHotspotCameraTargets(undefined, [])).toBeUndefined()
	})
})
