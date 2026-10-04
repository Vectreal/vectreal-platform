/**
 * Looking through a hotspot's camera in the Camera tool is a mode: closing the
 * tool puts back the camera the author had before. Editing a hotspot never
 * enters it, because placing a marker writes its camera and the view would
 * jerk with every placement.
 */
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import {
	activeHotspotIdAtom,
	cameraAtom,
	exitHotspotCameraAtom,
	hotspotCameraModeAtom,
	hotspotsAtom,
	resetHotspotEditingAtom,
	selectCameraAtom,
	selectedCameraIdAtom
} from './scene-settings-store'

import type { HotspotDefinition } from '@vctrl/core'

const hotspot = (id: string, linkedCameraId?: string): HotspotDefinition => ({
	id,
	name: id,
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	linkedCameraId
})

function arrange() {
	const store = createStore()
	store.set(cameraAtom, {
		cameras: [
			{ cameraId: 'front', name: 'Front', kind: 'scene', initial: true },
			{ cameraId: 'side', name: 'Side', kind: 'scene' },
			{ cameraId: 'handle-cam', name: 'Handle camera', kind: 'hotspot' },
			// Saved before paired cameras were tagged.
			{ cameraId: 'hotspot-camera-1700000000000-lid', name: 'Lid camera' }
		]
	})
	store.set(hotspotsAtom, [
		hotspot('handle', 'handle-cam'),
		hotspot('lid', 'hotspot-camera-1700000000000-lid'),
		hotspot('label'),
		// Linked from the picker to the scene's own opening view.
		hotspot('overview', 'front')
	])
	store.set(selectedCameraIdAtom, 'side')
	return store
}

describe('editing a hotspot', () => {
	it('leaves the view where it is, whichever hotspot is opened', () => {
		// Placing a marker writes its camera, and the viewer applies an edit to
		// the camera it looks through at once: standing on it jerks the view.
		const store = arrange()
		store.set(activeHotspotIdAtom, 'handle')
		store.set(activeHotspotIdAtom, 'lid')
		store.set(activeHotspotIdAtom, null)

		expect(store.get(selectedCameraIdAtom)).toBe('side')
		expect(store.get(hotspotCameraModeAtom)).toBeNull()
	})
})

describe('the hotspot camera mode, from the Camera tool', () => {
	it('enters for a hotspot’s camera, tagged or not', () => {
		const store = arrange()
		store.set(selectCameraAtom, 'hotspot-camera-1700000000000-lid')

		expect(store.get(selectedCameraIdAtom)).toBe(
			'hotspot-camera-1700000000000-lid'
		)
		expect(store.get(hotspotCameraModeAtom)).toEqual({
			returnToCameraId: 'side'
		})
	})

	it('treats a scene camera a hotspot links as a scene camera', () => {
		const store = arrange()
		store.set(selectCameraAtom, 'front')

		expect(store.get(selectedCameraIdAtom)).toBe('front')
		expect(store.get(hotspotCameraModeAtom)).toBeNull()
	})

	it('treats an untagged scene camera a hotspot links as a scene camera', () => {
		// Older scenes carry no kind at all. The minted id is what marks a
		// hotspot's own camera, not the link, which the picker offers for any.
		const store = arrange()
		store.set(cameraAtom, (camera) => ({
			...camera,
			cameras: [
				...(camera.cameras ?? []),
				{ cameraId: 'legacy-side', name: 'Legacy side' }
			]
		}))
		store.set(hotspotsAtom, (hotspots) => [
			...hotspots,
			hotspot('legacy', 'legacy-side')
		])
		store.set(selectCameraAtom, 'legacy-side')

		expect(store.get(hotspotCameraModeAtom)).toBeNull()
	})

	it('returns to where it started however many hotspot cameras were hopped', () => {
		const store = arrange()
		store.set(selectCameraAtom, 'handle-cam')
		store.set(selectCameraAtom, 'hotspot-camera-1700000000000-lid')
		store.set(exitHotspotCameraAtom)

		expect(store.get(selectedCameraIdAtom)).toBe('side')
	})

	it('ends the mode where it is when a scene camera is picked', () => {
		const store = arrange()
		store.set(selectCameraAtom, 'handle-cam')
		store.set(selectCameraAtom, 'front')
		store.set(exitHotspotCameraAtom)

		expect(store.get(selectedCameraIdAtom)).toBe('front')
	})

	it('puts back the camera from before when the Camera tool lets go', () => {
		const store = arrange()
		store.set(selectCameraAtom, 'handle-cam')
		store.set(exitHotspotCameraAtom)

		expect(store.get(selectedCameraIdAtom)).toBe('side')
		expect(store.get(hotspotCameraModeAtom)).toBeNull()
	})

	it('falls back to the default camera when the one from before is gone', () => {
		const store = arrange()
		store.set(selectCameraAtom, 'handle-cam')
		store.set(cameraAtom, (camera) => ({
			...camera,
			cameras: camera.cameras?.filter((entry) => entry.cameraId !== 'side')
		}))
		store.set(exitHotspotCameraAtom)

		expect(store.get(selectedCameraIdAtom)).toBe('front')
	})
})

describe('resetHotspotEditingAtom', () => {
	it('clears the selection and the mode without moving the camera', () => {
		// A scene load sets its own default camera first; the reset after it must
		// not put back a camera from the scene that came before.
		const store = arrange()
		store.set(activeHotspotIdAtom, 'handle')
		store.set(selectCameraAtom, 'handle-cam')
		store.set(selectedCameraIdAtom, 'front')
		store.set(resetHotspotEditingAtom)

		expect(store.get(activeHotspotIdAtom)).toBeNull()
		expect(store.get(hotspotCameraModeAtom)).toBeNull()
		expect(store.get(selectedCameraIdAtom)).toBe('front')
	})
})
