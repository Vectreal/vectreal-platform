/**
 * Placing a marker is one edit across two atoms, and the second one is the one
 * that goes missing: dropping the camera write leaves the hotspot moving on its
 * own, type-checks cleanly, and breaks nothing else. So the wiring is tested
 * against a real store rather than asserted about in a comment.
 */
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import { applyHotspotPlacement } from './apply-hotspot-placement'
import { cameraAtom, hotspotsAtom } from '../../../stores/scene-settings-store'

import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const AT: [number, number, number] = [1, 2, 3]

const hotspot = (
	id: string,
	overrides: Partial<HotspotDefinition> = {}
): HotspotDefinition => ({
	id,
	name: id,
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const seed = (hotspots: HotspotDefinition[], cameras: CameraConfig[]) => {
	const store = createStore()
	store.set(hotspotsAtom, hotspots)
	store.set(cameraAtom, { cameras })
	return store
}

describe('applyHotspotPlacement', () => {
	it('moves the hotspot and turns the camera it owns, in one edit', () => {
		const store = seed(
			[hotspot('a', { linkedCameraId: 'cam-a' })],
			[{ cameraId: 'cam-a', name: 'A Camera', kind: 'hotspot' }]
		)

		applyHotspotPlacement(store, 'a', AT)

		expect(store.get(hotspotsAtom)[0].worldPosition).toEqual(AT)
		expect(store.get(cameraAtom).cameras?.[0].target).toEqual(AT)
	})

	it('moves a hotspot that owns no camera without touching the cameras', () => {
		const cameras: CameraConfig[] = [
			{ cameraId: 'default', name: 'Default', kind: 'scene' }
		]
		const store = seed([hotspot('a', { linkedCameraId: 'default' })], cameras)

		applyHotspotPlacement(store, 'a', AT)

		expect(store.get(hotspotsAtom)[0].worldPosition).toEqual(AT)
		expect(store.get(cameraAtom).cameras?.[0].target).toBeUndefined()
	})

	it('leaves the other hotspots alone', () => {
		const store = seed(
			[
				hotspot('a', { linkedCameraId: 'cam-a' }),
				hotspot('b', { worldPosition: [7, 7, 7] })
			],
			[{ cameraId: 'cam-a', name: 'A Camera', kind: 'hotspot' }]
		)

		applyHotspotPlacement(store, 'a', AT)

		expect(store.get(hotspotsAtom)[1].worldPosition).toEqual([7, 7, 7])
	})
})
