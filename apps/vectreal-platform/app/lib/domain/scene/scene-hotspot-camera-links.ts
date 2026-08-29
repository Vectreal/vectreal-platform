/**
 * Every edit that has to reach a hotspot and the cameras around it at once.
 *
 * A link naming a camera that is gone fails server validation, so one unguarded
 * delete blocked every later save of that scene with a message naming neither
 * the hotspot nor the camera. Each panel edits one end of the link, which is how
 * camera deletion came to be written with no knowledge that hotspots exist at
 * all; both ends go through here so neither of them owns the contract.
 */

import { applyDefaultCameraFlag, isLastSceneCamera } from './scene-camera'

import type { CameraLike } from './scene-camera'
import type { CameraProps, HotspotDefinition } from '@vctrl/core'

export interface CameraHotspotState {
	camera: CameraProps
	hotspots: HotspotDefinition[]
}

const cameraNameForHotspot = (hotspotName: string): string =>
	`${hotspotName || 'Unnamed Hotspot'} Camera`

/**
 * Mints a hotspot together with the camera it owns, already linked.
 *
 * `kind` is what every ownership test below keys off, and a camera minted
 * without it also reads as a scene camera to `isSceneCamera`, which lets it be
 * picked as the frame the scene opens on — a frame nobody composed.
 */
export function addHotspot(
	state: CameraHotspotState,
	ids: { hotspotId: string; cameraId: string }
): CameraHotspotState {
	const hotspot: HotspotDefinition = {
		id: ids.hotspotId,
		name: 'New Hotspot',
		worldPosition: [0, 0, 0],
		visible: true,
		internalOnly: false,
		occlusionEnabled: true,
		stylePreset: 'dot',
		linkedCameraId: ids.cameraId
	}

	return {
		camera: {
			...state.camera,
			cameras: [
				...(state.camera.cameras ?? []),
				{
					cameraId: ids.cameraId,
					kind: 'hotspot',
					name: cameraNameForHotspot(hotspot.name),
					fov: 60
				}
			]
		},
		hotspots: [...state.hotspots, hotspot]
	}
}

/**
 * A camera is a hotspot's own when it was minted for it and nothing else points
 * at it.
 *
 * `addHotspot` pairs every new hotspot with a camera, and that pairing is what
 * makes the camera the hotspot's to rename or retire. The link is editable,
 * though: the Linked Camera picker offers every camera in the scene, so a
 * hotspot can be pointed at the default view or at another hotspot's camera.
 * Acting on whatever the link happens to name would rename or delete a camera
 * the author composed, and neither failure says anything on screen.
 *
 * Ownership takes the `kind` tag and nothing else, deliberately narrower than
 * `isPairedHotspotCamera`, which also infers a pair from the minted id shape.
 * Retiring is destructive, and the floors that stop it taking a camera the
 * scene needs - `isLastSceneCamera`, `resolveDefaultSceneCamera` - all read
 * `isSceneCamera`, which counts an untagged camera as a scene camera. Inferring
 * ownership from the id would put those two rules at odds: a legacy paired
 * camera would become both retirable and the frame the scene opens on, so
 * deleting its hotspot would silently take the opening frame with it.
 *
 * The looser predicate belongs where guessing wrong hides a viewpoint instead
 * of destroying one - the embed manifest reads it to decide which cameras an
 * `internalOnly` hotspot takes with it.
 */
const resolveOwnedCameraId = (
	linkedBy: readonly HotspotDefinition[],
	cameras: readonly CameraLike[] | undefined,
	cameraId: string | undefined
): string | undefined => {
	if (!cameraId) return undefined

	const camera = cameras?.find((c) => c.cameraId === cameraId)
	if (camera?.kind !== 'hotspot') return undefined

	return linkedBy.some((h) => h.linkedCameraId === cameraId)
		? undefined
		: cameraId
}

const resolveOwnedHotspotCameraId = (
	hotspots: readonly HotspotDefinition[],
	cameras: readonly CameraLike[] | undefined,
	hotspotId: string
): string | undefined =>
	resolveOwnedCameraId(
		hotspots.filter((h) => h.id !== hotspotId),
		cameras,
		hotspots.find((h) => h.id === hotspotId)?.linkedCameraId
	)

/**
 * The camera left behind when a hotspot is pointed somewhere else.
 *
 * Relinking strands the camera that was minted with the hotspot: nothing points
 * at it any more, and it shows up in the camera picker under the name of a
 * hotspot that no longer uses it. Dropping it keeps that list honest.
 *
 * Only while it is still empty, though. Once someone has framed it with "Set
 * camera to current view" it holds work, and relinking is not the moment to
 * throw that away — the author can point a hotspot back at it later.
 */
const resolveStrandedHotspotCameraId = (
	hotspots: readonly HotspotDefinition[],
	cameras: readonly CameraLike[] | undefined,
	previousCameraId: string | undefined
): string | undefined => {
	const ownedId = resolveOwnedCameraId(hotspots, cameras, previousCameraId)
	if (!ownedId) return undefined

	const camera = cameras?.find((c) => c.cameraId === ownedId)
	const isFramed =
		camera?.position !== undefined ||
		camera?.rotation !== undefined ||
		camera?.target !== undefined

	return isFramed ? undefined : ownedId
}

/**
 * Refuses, with `null`, to take the only camera or the only one the scene can
 * open on: `resolveDefaultSceneCamera` falls back to the first entry of any
 * kind, so taking the last scene camera away promotes a hotspot camera to the
 * opening view without saying so.
 */
export function removeCamera(
	state: CameraHotspotState,
	cameraId: string
): CameraHotspotState | null {
	const cameras = state.camera.cameras ?? []
	if (cameras.length <= 1 || isLastSceneCamera(cameras, cameraId)) return null

	return {
		camera: {
			...state.camera,
			cameras: applyDefaultCameraFlag(
				cameras.filter((entry) => entry.cameraId !== cameraId)
			)
		},
		hotspots: state.hotspots.map((h) =>
			h.linkedCameraId === cameraId ? { ...h, linkedCameraId: undefined } : h
		)
	}
}

/**
 * Retires the camera the hotspot owns along with it.
 *
 * Sequence indices are left exactly as the author set them, because the server
 * takes any distinct non-negative integers, gaps included.
 *
 * That makes this function's output legal but not necessarily what an author
 * should see. The publisher's list *is* the playback order now, so a gap there
 * would read as a missing step; the hotspot panel pipes the survivors through
 * `reorderSequence` after calling this. Renumbering here instead would put the
 * decision in the wrong place: this module owns the hotspot/camera link, and a
 * caller that does not display the order has no reason to have it rewritten.
 */
export function removeHotspot(
	state: CameraHotspotState,
	hotspotId: string
): CameraHotspotState {
	const ownedCameraId = resolveOwnedHotspotCameraId(
		state.hotspots,
		state.camera.cameras,
		hotspotId
	)
	const withoutHotspot = {
		camera: state.camera,
		hotspots: state.hotspots.filter((h) => h.id !== hotspotId)
	}
	if (!ownedCameraId) return withoutHotspot

	// An owned camera is a hotspot camera, so it is never the last one the scene
	// can open on and `removeCamera` has no floor left to hit.
	return removeCamera(withoutHotspot, ownedCameraId) ?? withoutHotspot
}

/**
 * Points a hotspot at another camera, dropping the one it was minted with when
 * that leaves it stranded and unframed.
 */
export function relinkHotspot(
	state: CameraHotspotState,
	hotspotId: string,
	cameraId: string | undefined
): CameraHotspotState {
	const previousCameraId = state.hotspots.find(
		(h) => h.id === hotspotId
	)?.linkedCameraId
	const relinked = {
		camera: state.camera,
		hotspots: state.hotspots.map((h) =>
			h.id === hotspotId ? { ...h, linkedCameraId: cameraId } : h
		)
	}

	const strandedCameraId = resolveStrandedHotspotCameraId(
		relinked.hotspots,
		state.camera.cameras,
		previousCameraId
	)
	if (!strandedCameraId) return relinked

	// A stranded camera is a hotspot camera, so it is never the last one the
	// scene can open on and `removeCamera` has no floor left to hit.
	return removeCamera(relinked, strandedCameraId) ?? relinked
}

/**
 * Renames a hotspot and the camera it owns together.
 *
 * The camera picker lists cameras by name and nothing else, so a rename that
 * stopped at the hotspot would leave every hotspot camera in the scene sharing
 * one label with no way to tell them apart.
 */
/**
 * Moves a hotspot, and takes the camera it owns along with it.
 *
 * A hotspot camera exists to look at its hotspot, so a marker that moves and a
 * viewpoint that stays behind is a scene that quietly stops making sense: the
 * author drags a marker onto the handle and the camera keeps framing where it
 * used to be. Placement is the moment the author says where the point of
 * interest is, so it is the moment the aim follows.
 *
 * Only the camera the hotspot owns. The Linked Camera picker offers every
 * camera in the scene, so a hotspot can point at the opening frame or at
 * another hotspot's camera, and re-aiming one of those would rewrite a
 * viewpoint the author composed by moving something else entirely.
 *
 * Position is left alone here too - this decides where the camera looks, not
 * where it stands, so a viewpoint the author framed keeps its framing and
 * merely turns to follow the marker.
 *
 * Distinct from the viewer's `resolveHotspotCameraTargets`, and both are wanted.
 * That one is a runtime default for a camera nobody ever framed, and it stops
 * applying the moment a target exists. This one is the authoring edit: it moves
 * a target that is already there, which is the case the default cannot reach.
 */
export function placeHotspot(
	state: CameraHotspotState,
	hotspotId: string,
	worldPosition: [number, number, number]
): CameraHotspotState {
	const hotspots = state.hotspots.map((h) =>
		h.id === hotspotId ? { ...h, worldPosition } : h
	)
	const ownedCameraId = resolveOwnedHotspotCameraId(
		state.hotspots,
		state.camera.cameras,
		hotspotId
	)
	if (!ownedCameraId) return { camera: state.camera, hotspots }

	return {
		camera: {
			...state.camera,
			cameras: (state.camera.cameras ?? []).map((entry) =>
				entry.cameraId === ownedCameraId
					? { ...entry, target: worldPosition }
					: entry
			)
		},
		hotspots
	}
}

export function renameHotspot(
	state: CameraHotspotState,
	hotspotId: string,
	name: string
): CameraHotspotState {
	const hotspots = state.hotspots.map((h) =>
		h.id === hotspotId ? { ...h, name } : h
	)
	const ownedCameraId = resolveOwnedHotspotCameraId(
		state.hotspots,
		state.camera.cameras,
		hotspotId
	)
	if (!ownedCameraId) return { camera: state.camera, hotspots }

	return {
		camera: {
			...state.camera,
			cameras: (state.camera.cameras ?? []).map((entry) =>
				entry.cameraId === ownedCameraId
					? { ...entry, name: cameraNameForHotspot(name) }
					: entry
			)
		},
		hotspots
	}
}

/**
 * Follows every hotspot link onto a camera's new id.
 *
 * A camera id is derived from its name, so renaming one mints a new id and
 * retires the old one. The links have to move with it or they name nothing.
 */
export function repointHotspotLinks(
	hotspots: readonly HotspotDefinition[],
	fromCameraId: string,
	toCameraId: string
): HotspotDefinition[] {
	return hotspots.map((h) =>
		h.linkedCameraId === fromCameraId ? { ...h, linkedCameraId: toCameraId } : h
	)
}
