import { cameraAtom, hotspotsAtom } from '../../../stores/scene-settings-store'
import { placeHotspot } from '../scene-hotspot-camera-links'

import type { createStore } from 'jotai'

type PublisherStore = ReturnType<typeof createStore>

/**
 * Commits a hotspot placement to the two atoms it spans.
 *
 * Placing a marker is one edit across two pieces of state: the hotspot moves,
 * and the camera it owns turns to keep looking at it. `placeHotspot` decides
 * both; this puts the answer back.
 *
 * It lives here rather than inside `PublisherEditorScene` for two reasons. The
 * component mounts inside an R3F canvas and has no test that can reach it, so
 * logic left in there is logic nothing can check - and this is the wiring, which
 * is precisely the part that fails silently: dropping the camera write leaves
 * the marker moving on its own, type-checks cleanly and breaks no other test.
 *
 * Reading through the store rather than through hooks also keeps the caller's
 * callback referentially stable, which matters because it reaches the transform
 * gizmo as `onMove`, and the gizmo's unmount cleanup commits an interrupted
 * drag - a new identity mid-drag would fire that cleanup under the author.
 */
export function applyHotspotPlacement(
	store: PublisherStore,
	hotspotId: string,
	worldPosition: [number, number, number]
): void {
	const next = placeHotspot(
		{ camera: store.get(cameraAtom), hotspots: store.get(hotspotsAtom) },
		hotspotId,
		worldPosition
	)

	store.set(hotspotsAtom, next.hotspots)
	store.set(cameraAtom, next.camera)
}
