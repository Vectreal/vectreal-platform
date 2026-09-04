import { cameraAtom, hotspotsAtom } from '../../../stores/scene-settings-store'
import { reanchorHotspotsForScale } from '../scene-hotspot-reanchor'

import type { createStore } from 'jotai'

type PublisherStore = ReturnType<typeof createStore>

/**
 * Commits a normalization re-anchor to the two atoms it spans.
 *
 * The same shape as `applyHotspotPlacement`, and here for the same reason: this
 * is the wiring, and dropping the camera write leaves the marker moving on its
 * own without failing anything. Writing through the store keeps the caller's
 * handler referentially stable.
 *
 * A scale that did not change needs no guard here: `reanchorHotspotsForScale`
 * returns the state it was given by identity, and jotai compares with `Object.is`
 * before notifying, so setting the same reference back is already a no-op. An
 * early return would be a line no test could ever hold.
 */
export function applyHotspotReanchor(
	store: PublisherStore,
	previousScale: number,
	nextScale: number
): void {
	const state = {
		camera: store.get(cameraAtom),
		hotspots: store.get(hotspotsAtom)
	}

	const next = reanchorHotspotsForScale(state, previousScale, nextScale)

	store.set(hotspotsAtom, next.hotspots)
	store.set(cameraAtom, next.camera)
}
