/**
 * Re-anchoring is one edit across two atoms, and the second one is the one that
 * goes missing: dropping the camera write leaves markers moving while every
 * hotspot camera keeps aiming where its marker used to be. It type-checks
 * cleanly and breaks nothing else, so the wiring is tested against a real store
 * rather than asserted about in a comment - the same reason
 * `apply-hotspot-placement.spec.ts` exists.
 */
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import { applyHotspotReanchor } from './apply-hotspot-reanchor'
import { cameraAtom, hotspotsAtom } from '../../../stores/scene-settings-store'

import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const hotspot = (
	id: string,
	worldPosition: [number, number, number],
	overrides: Partial<HotspotDefinition> = {}
): HotspotDefinition => ({
	id,
	name: id,
	worldPosition,
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

/** One marker and the camera it owns, aimed at it, as `placeHotspot` leaves them. */
const seed = () => {
	const store = createStore()
	store.set(hotspotsAtom, [
		hotspot('h1', [2, 4, 6], { linkedCameraId: 'cam-a' })
	])
	store.set(cameraAtom, {
		cameras: [
			{ cameraId: 'cam-a', name: 'cam-a', kind: 'hotspot', target: [2, 4, 6] }
		] as CameraConfig[]
	})
	return store
}

const targetOf = (store: ReturnType<typeof createStore>) =>
	store.get(cameraAtom).cameras?.[0].target

describe('applyHotspotReanchor', () => {
	it('moves the marker', () => {
		const store = seed()

		applyHotspotReanchor(store, 1, 2)

		expect(store.get(hotspotsAtom)[0].worldPosition).toEqual([4, 8, 12])
	})

	it('turns the camera that marker owns', () => {
		const store = seed()

		applyHotspotReanchor(store, 1, 2)

		expect(targetOf(store)).toEqual([4, 8, 12])
	})

	it('applies the scales in the order it is given them', () => {
		// Swapping the two arguments at the call site is the silent mutation: the
		// markers still move, by the inverse ratio, onto a model that grew.
		const store = seed()

		applyHotspotReanchor(store, 2, 1)

		expect(store.get(hotspotsAtom)[0].worldPosition).toEqual([1, 2, 3])
	})

	it('writes nothing when the scale did not change', () => {
		// An unrelated normalization edit must not mark the scene dirty.
		const store = seed()
		const before = store.get(hotspotsAtom)
		const camerasBefore = store.get(cameraAtom)

		applyHotspotReanchor(store, 3, 3)

		expect(store.get(hotspotsAtom)).toBe(before)
		expect(store.get(cameraAtom)).toBe(camerasBefore)
	})

	it('writes nothing for a degenerate scale', () => {
		const store = seed()
		const before = store.get(hotspotsAtom)

		applyHotspotReanchor(store, 0, 2)

		expect(store.get(hotspotsAtom)).toBe(before)
	})
})
