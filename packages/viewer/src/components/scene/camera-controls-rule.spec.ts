import { describe, expect, it } from 'vitest'

import { shouldShowCameraControls } from './camera-controls-rule'
import {
	resolveHotspotViewName,
	resolveSceneViewCameras
} from './scene-view-return'

describe('shouldShowCameraControls', () => {
	const show = (
		sceneViewCount: number,
		authorAllows?: boolean,
		hostAllows = true
	) => shouldShowCameraControls({ sceneViewCount, authorAllows, hostAllows })

	it('shows once there are two views to switch between', () => {
		expect(show(2)).toBe(true)
		expect(show(5)).toBe(true)
	})

	it('has nothing to offer with one view or none', () => {
		expect(show(1)).toBe(false)
		expect(show(0)).toBe(false)
	})

	it('reads an absent author setting as yes', () => {
		expect(show(2, undefined)).toBe(true)
		expect(show(2, true)).toBe(true)
		expect(show(2, false)).toBe(false)
	})

	it('lets the host keep it off whatever the scene says', () => {
		expect(show(3, true, false)).toBe(false)
	})
})

describe('resolveSceneViewCameras', () => {
	it("leaves out a hotspot's close-up, tagged or only linked", () => {
		const cameras = [
			{ cameraId: 'hero' },
			{ cameraId: 'tagged', kind: 'hotspot' as const },
			{ cameraId: 'legacy' },
			{ cameraId: 'side', kind: 'scene' as const }
		]
		const links = [{ linkedCameraId: 'legacy' }]

		expect(
			resolveSceneViewCameras(cameras, links).map((camera) => camera.cameraId)
		).toEqual(['hero', 'side'])
	})

	it('keeps a scene camera a marker happens to link', () => {
		const cameras = [{ cameraId: 'hero', kind: 'scene' as const }]
		expect(
			resolveSceneViewCameras(cameras, [{ linkedCameraId: 'hero' }])
		).toHaveLength(1)
	})
})

describe('resolveHotspotViewName', () => {
	const hotspots = [
		{ name: 'Handle', linkedCameraId: 'hotspot-camera-a' },
		{ name: '  ', linkedCameraId: 'hotspot-camera-b' },
		{ name: 'Label' }
	]

	it('names the hotspot whose camera holds the view, drawn or not', () => {
		expect(resolveHotspotViewName('hotspot-camera-a', hotspots)).toBe('Handle')
	})

	it('is null for a blank name, an unlinked camera, or no camera yet', () => {
		expect(resolveHotspotViewName('hotspot-camera-b', hotspots)).toBeNull()
		expect(resolveHotspotViewName('front', hotspots)).toBeNull()
		expect(resolveHotspotViewName(null, hotspots)).toBeNull()
	})
})
