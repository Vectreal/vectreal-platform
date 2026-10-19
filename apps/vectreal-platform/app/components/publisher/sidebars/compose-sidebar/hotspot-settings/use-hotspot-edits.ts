import { useAtom, useSetAtom, useStore } from 'jotai/react'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { applyHotspotPlacement } from '../../../../../lib/domain/scene/client/apply-hotspot-placement'
import {
	PAIRED_HOTSPOT_CAMERA_ID_PREFIX,
	resolveDefaultSceneCameraId
} from '../../../../../lib/domain/scene/scene-camera'
import {
	addHotspot,
	interactionSwitchesTo,
	relinkHotspot,
	removeHotspot,
	renameHotspot
} from '../../../../../lib/domain/scene/scene-hotspot-camera-links'
import {
	reorderSequence,
	setSequenceMembership
} from '../../../../../lib/domain/scene/scene-hotspot-sequence'
import {
	activeHotspotIdAtom,
	cameraAtom,
	hotspotsAtom,
	interactionsAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import { describeCameraRemoval } from '../camera-controls-settings/camera-removal-notice'

import type {
	CameraProps,
	HotspotDefinition,
	SceneInteractionDefinition
} from '@vctrl/core'

/**
 * `scene_hotspots.id` is a uuid primary key, so the hotspot id has to be a real
 * uuid. It was once minted as `hotspot-<timestamp>-<random>`, which Postgres
 * rejected on insert, and because that insert shares a transaction with the
 * settings and asset writes it failed the entire scene save rather than just
 * the hotspot.
 */
const mintHotspotIds = () => ({
	hotspotId: crypto.randomUUID(),
	cameraId: `${PAIRED_HOTSPOT_CAMERA_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
})

/**
 * Where the editor sits once retiring a hotspot's camera has taken the one it
 * was on.
 *
 * The viewer is pointed by `selectedCameraId`, so a selection naming a camera
 * that is gone aims it at nothing until the Camera tool is opened and runs its
 * own reconcile. Landing on the scene default is the answer that tool gives.
 */
const survivingSelectedCameraId = (
	cameras: CameraProps['cameras'],
	selectedCameraId: string
): string => {
	if (cameras?.some((entry) => entry.cameraId === selectedCameraId)) {
		return selectedCameraId
	}
	return resolveDefaultSceneCameraId(cameras) ?? selectedCameraId
}

/**
 * Says so when an edit retired a camera that interactions switched to.
 *
 * Deleting or relinking a marker can retire the camera it owned, and the
 * interactions that switched to it go with it. That happens in another panel's
 * data, so the author hears about it here or not at all. No hotspot is named:
 * the only one that used the retired camera is the one being edited.
 */
const announceRetiredCameras = (
	interactions: SceneInteractionDefinition[] | undefined,
	camerasBefore: CameraProps['cameras'],
	camerasAfter: CameraProps['cameras']
) => {
	const kept = new Set(camerasAfter?.map((entry) => entry.cameraId))
	const retired = (camerasBefore ?? [])
		.map((entry) => entry.cameraId)
		.filter((cameraId): cameraId is string => !!cameraId && !kept.has(cameraId))

	const notice = describeCameraRemoval(
		[],
		(interactions ?? []).filter((interaction) =>
			retired.some((cameraId) => interactionSwitchesTo(interaction, cameraId))
		).length
	)
	if (notice) toast.info(notice)
}

/** The markers in the sequence, in order, and the rest in authoring order. */
export const sequencedFirst = (hotspots: readonly HotspotDefinition[]) => {
	const inSequence = hotspots
		.filter((hotspot) => hotspot.sequenceIndex !== undefined)
		.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number))

	return {
		inSequence,
		rest: hotspots.filter((hotspot) => hotspot.sequenceIndex === undefined)
	}
}

/**
 * Trimmed, because the save parser refuses a whitespace-only name as no name
 * and tells the author to look for this label. Untrimmed, a name of one space
 * was listed blank, and the row that message points at did not exist.
 */
export const hotspotDisplayName = (hotspot: HotspotDefinition) =>
	hotspot.name.trim() || 'Unnamed hotspot'

/**
 * Every edit the panel makes to a marker. Each one that touches a marker's
 * paired camera goes through the `scene-hotspot-camera-links` operations, so
 * the hotspot and the camera it owns never disagree.
 */
export function useHotspotEdits() {
	const store = useStore()
	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [interactions, setInteractions] = useAtom(interactionsAtom)
	const setSelectedId = useSetAtom(activeHotspotIdAtom)
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	const { requestSceneCameraSnapshot } = usePublisherViewerCapture()

	const update = useCallback(
		(id: string, patch: Partial<HotspotDefinition>) => {
			setHotspots((prev) =>
				prev.map((hotspot) =>
					hotspot.id === id ? { ...hotspot, ...patch } : hotspot
				)
			)
		},
		[setHotspots]
	)

	/**
	 * The new hotspot's camera starts where the editor is standing, so the
	 * hotspot is a real viewpoint from the moment it exists rather than a camera
	 * that only swings the pivot until someone sets it.
	 *
	 * The scene is read after the capture, not closed over: an edit landing
	 * while the capture is in flight would otherwise be overwritten.
	 */
	const add = useCallback(async () => {
		const snapshot = await requestSceneCameraSnapshot()
		const ids = mintHotspotIds()
		const next = addHotspot(
			{ camera: store.get(cameraAtom), hotspots: store.get(hotspotsAtom) },
			ids,
			snapshot ? { position: snapshot.position, fov: snapshot.fov } : undefined
		)

		setHotspots(next.hotspots)
		setCamera(next.camera)
		setSelectedId(ids.hotspotId)
	}, [requestSceneCameraSnapshot, setCamera, setHotspots, setSelectedId, store])

	/**
	 * Deleting renumbers what is left.
	 *
	 * Removing step 2 of 3 used to leave indices 0 and 2. That was invisible
	 * while a number field owned the display; now that the list *is* the order,
	 * a gap would show as steps 1 and 3 with nothing between them.
	 *
	 * Returns what is left of the sequence when the marker was in it, for the
	 * announcement, and null when it was not.
	 */
	const remove = useCallback(
		(id: string): { remainingInSequence: number } | null => {
			const next = removeHotspot({ camera, hotspots, interactions }, id)
			const survivingOrder = sequencedFirst(next.hotspots).inSequence.map(
				(hotspot) => hotspot.id
			)

			setHotspots(reorderSequence(next.hotspots, survivingOrder))
			setCamera(next.camera)
			setInteractions(next.interactions)
			announceRetiredCameras(interactions, camera.cameras, next.camera.cameras)
			setSelectedCameraId((prev) =>
				survivingSelectedCameraId(next.camera.cameras, prev)
			)
			setSelectedId((prev) => (prev === id ? null : prev))

			const wasSequenced = hotspots.some(
				(hotspot) => hotspot.id === id && hotspot.sequenceIndex !== undefined
			)
			return wasSequenced
				? { remainingInSequence: survivingOrder.length }
				: null
		},
		[
			camera,
			hotspots,
			interactions,
			setCamera,
			setHotspots,
			setInteractions,
			setSelectedCameraId,
			setSelectedId
		]
	)

	const rename = useCallback(
		(id: string, name: string) => {
			const next = renameHotspot({ camera, hotspots }, id, name)

			setHotspots(next.hotspots)
			setCamera(next.camera)
		},
		[camera, hotspots, setCamera, setHotspots]
	)

	const relink = useCallback(
		(id: string, linkedCameraId: string | undefined) => {
			const next = relinkHotspot(
				{ camera, hotspots, interactions },
				id,
				linkedCameraId
			)

			setHotspots(next.hotspots)
			setCamera(next.camera)
			setInteractions(next.interactions)
			announceRetiredCameras(interactions, camera.cameras, next.camera.cameras)
			setSelectedCameraId((prev) =>
				survivingSelectedCameraId(next.camera.cameras, prev)
			)
		},
		[
			camera,
			hotspots,
			interactions,
			setCamera,
			setHotspots,
			setInteractions,
			setSelectedCameraId
		]
	)

	const setMembership = useCallback(
		(id: string, memberOfSequence: boolean) => {
			setHotspots((prev) => setSequenceMembership(prev, id, memberOfSequence))
		},
		[setHotspots]
	)

	/**
	 * Takes the hotspot it is editing rather than reading the selection, so a
	 * view still on screen while it animates out cannot write to the marker
	 * that replaced it.
	 */
	const setAxis = useCallback(
		(hotspot: HotspotDefinition, axis: 0 | 1 | 2, raw: string) => {
			const value = parseFloat(raw)
			if (isNaN(value)) return
			const next = [...hotspot.worldPosition] as [number, number, number]
			next[axis] = value
			// The same paired edit the canvas makes: a marker moves and the camera
			// it owns turns to keep looking at it. Typing a coordinate is placing
			// the marker just as much as dragging it is, so it cannot be the one
			// path that leaves the viewpoint behind.
			applyHotspotPlacement(store, hotspot.id, next)
		},
		[store]
	)

	return { update, add, remove, rename, relink, setMembership, setAxis }
}
