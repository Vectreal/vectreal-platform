import { deriveUniqueSlug } from '@shared/utils'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo } from 'react'

import {
	applySnapshotToCamera,
	normalizeCameraState,
	resolveEditorTargetCameraId,
	withDefaultCameraFlag,
	type CameraEntry
} from './camera-state'
import { defaultCameraOptions } from './constants'
import {
	isLastSceneCamera,
	resolveDefaultSceneCameraId
} from '../../../../../lib/domain/scene/scene-camera'
import {
	removeCamera,
	repointHotspotLinks
} from '../../../../../lib/domain/scene/scene-hotspot-camera-links'
import {
	cameraAtom,
	exitHotspotCameraAtom,
	hotspotCameraModeAtom,
	hotspotsAtom,
	selectCameraAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import { useOpeningViewCapture } from '../../../shell/use-opening-view'

/**
 * The scene's cameras, the one being edited, and every edit to them.
 *
 * Mounted once, by the panel: it also keeps the selection pointing at a camera
 * that exists, which more than one instance would do more than once.
 */
export function useSceneCameras() {
	const [camera, setCamera] = useAtom(cameraAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const selectCamera = useSetAtom(selectCameraAtom)
	const exitHotspotCamera = useSetAtom(exitHotspotCameraAtom)
	const hotspotCameraMode = useAtomValue(hotspotCameraModeAtom)
	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const { requestSceneCameraSnapshot } = usePublisherViewerCapture()
	const { setOpeningView } = useOpeningViewCapture()

	const normalizedCamera = useMemo(() => normalizeCameraState(camera), [camera])
	const cameras = useMemo(
		() => normalizedCamera.cameras ?? [],
		[normalizedCamera.cameras]
	)
	const selectedCamera =
		cameras.find((entry) => entry.cameraId === selectedCameraId) ??
		cameras.find(
			(entry) => entry.cameraId === normalizedCamera.activeCameraId
		) ??
		cameras[0]
	const defaultCameraId = resolveDefaultSceneCameraId(cameras)
	const editorTargetCameraId = resolveEditorTargetCameraId(
		normalizedCamera,
		selectedCameraId
	)
	const isEditingDefaultCamera = defaultCameraId === editorTargetCameraId
	// Greying the button out is courtesy; `removeCamera` is what enforces both
	// floors, since the panel is not the only thing that can reach the atom.
	const canDeleteSelected =
		cameras.length > 1 && !isLastSceneCamera(cameras, editorTargetCameraId)

	/** Which hotspot owns each camera, for the camera list. */
	const hotspotNameByCameraId = useMemo(
		() =>
			Object.fromEntries(
				hotspots
					.filter((hotspot) => hotspot.linkedCameraId)
					.map((hotspot) => [hotspot.linkedCameraId, hotspot.name])
			) as Record<string, string | undefined>,
		[hotspots]
	)

	useEffect(() => {
		const nextSelectedId = selectedCamera?.cameraId
		if (nextSelectedId && selectedCameraId !== nextSelectedId) {
			setSelectedCameraId(nextSelectedId)
		}
	}, [selectedCamera?.cameraId, selectedCameraId, setSelectedCameraId])

	const updateSelected = useCallback(
		(update: (cameraEntry: CameraEntry) => CameraEntry) => {
			setCamera((prev) => {
				const normalized = normalizeCameraState(prev)
				// The editor's camera, not the viewport's active one.
				const targetCameraId = resolveEditorTargetCameraId(
					normalized,
					selectedCameraId
				)
				if (!targetCameraId) {
					return normalized
				}

				return withDefaultCameraFlag({
					...normalized,
					cameras: (normalized.cameras ?? []).map((cameraEntry) =>
						cameraEntry.cameraId === targetCameraId
							? update(cameraEntry)
							: cameraEntry
					)
				})
			})
		},
		[selectedCameraId, setCamera]
	)

	const setFov = useCallback(
		(fov: number) => updateSelected((entry) => ({ ...entry, fov })),
		[updateSelected]
	)

	/**
	 * Selecting only changes the selection and moves the viewport. Writing the
	 * live viewport into a saved camera is reserved for "Set camera to current
	 * view", so reviewing cameras never overwrites one.
	 *
	 * A hotspot's camera is picked into the hotspot camera mode, so closing the
	 * tool puts the author back where they were; a scene camera stays picked.
	 */
	const select = selectCamera

	const add = useCallback(async () => {
		const snapshot = await requestSceneCameraSnapshot()
		let newCameraId = ''
		setCamera((prev) => {
			const normalized = normalizeCameraState(prev)
			const currentCameraId = resolveEditorTargetCameraId(
				normalized,
				selectedCameraId
			)
			const sourceCamera =
				normalized.cameras?.find(
					(entry) => entry.cameraId === currentCameraId
				) ?? normalized.cameras?.[0]

			const newName = `Camera ${(normalized.cameras?.length ?? 0) + 1}`
			newCameraId = deriveUniqueSlug(
				newName,
				(normalized.cameras ?? []).map((entry) => entry.cameraId),
				{ fallback: 'camera' }
			)

			const newCamera: CameraEntry = {
				...applySnapshotToCamera(
					(sourceCamera ??
						defaultCameraOptions.cameras?.[0] ?? {
							cameraId: newCameraId,
							name: newName
						}) as CameraEntry,
					snapshot
				),
				cameraId: newCameraId,
				name: newName,
				// The source camera is whichever one the editor was on, which can be a
				// hotspot's. Inheriting that kind would leave the new camera unable to
				// ever become the default, with the pin button silently doing nothing.
				kind: 'scene'
			}

			// The new camera starts at the current view; existing cameras are left
			// as they were saved.
			return withDefaultCameraFlag({
				...normalized,
				activeCameraId: newCameraId,
				cameras: [...(normalized.cameras ?? []), newCamera]
			})
		})
		if (newCameraId) selectCamera(newCameraId)
	}, [requestSceneCameraSnapshot, selectCamera, selectedCameraId, setCamera])

	const removeSelected = useCallback(() => {
		const next = removeCamera(
			{ camera: normalizedCamera, hotspots },
			editorTargetCameraId
		)
		if (!next) return

		// Landing on the first survivor would select a hotspot's camera whenever
		// one sits ahead of the remaining scene cameras, and the editor treats
		// whatever is selected as the camera "Set camera to current view" writes.
		const nextCamera = {
			...next.camera,
			activeCameraId: resolveDefaultSceneCameraId(next.camera.cameras)
		}

		setCamera(nextCamera)
		setHotspots(next.hotspots)
		// Deleting the hotspot camera the mode stands on ends the mode the way
		// closing the tool would, back where the author started.
		if (hotspotCameraMode) exitHotspotCamera()
		else selectCamera(nextCamera.activeCameraId ?? '')
	}, [
		editorTargetCameraId,
		exitHotspotCamera,
		hotspotCameraMode,
		hotspots,
		normalizedCamera,
		selectCamera,
		setCamera,
		setHotspots
	])

	/** Renaming re-derives the id from the name, so hotspot links follow it. */
	const renameSelected = useCallback(
		(nextName: string) => {
			const oldId = selectedCamera?.cameraId
			if (!oldId) return

			const newId = deriveUniqueSlug(
				nextName,
				cameras.map((entry) => entry.cameraId),
				{ excludeId: oldId, fallback: 'camera' }
			)

			setCamera(
				withDefaultCameraFlag({
					...normalizedCamera,
					activeCameraId:
						normalizedCamera.activeCameraId === oldId
							? newId
							: normalizedCamera.activeCameraId,
					cameras: cameras.map((entry) =>
						entry.cameraId === oldId
							? { ...entry, cameraId: newId, name: nextName }
							: entry
					)
				})
			)

			if (newId !== oldId) {
				setSelectedCameraId(newId)
				setHotspots(repointHotspotLinks(hotspots, oldId, newId))
			}
		},
		[
			cameras,
			hotspots,
			normalizedCamera,
			selectedCamera?.cameraId,
			setCamera,
			setHotspots,
			setSelectedCameraId
		]
	)

	/** The default camera is the first one, so pinning moves it to the front. */
	const pinSelectedAsDefault = useCallback(() => {
		const targetId = selectedCamera?.cameraId
		if (!targetId) return

		setCamera((prev) => {
			const normalized = normalizeCameraState(prev)
			const all = normalized.cameras ?? []
			const target = all.find((entry) => entry.cameraId === targetId)
			if (!target) {
				return normalized
			}

			return withDefaultCameraFlag({
				...normalized,
				cameras: [target, ...all.filter((entry) => entry !== target)]
			})
		})
	}, [selectedCamera?.cameraId, setCamera])

	/**
	 * Pointing the default camera somewhere new moves the frame the scene opens
	 * on, and the thumbnail is the placeholder shown while loading resolves into
	 * that frame. Capturing both together is what stops the load from jumping.
	 * Other cameras are navigational and leave the opening view alone.
	 *
	 * Resolves to whether a view was captured.
	 */
	const captureCurrentView = useCallback(async (): Promise<boolean> => {
		if (isEditingDefaultCamera) {
			await setOpeningView()
			return true
		}
		const snapshot = await requestSceneCameraSnapshot()
		if (!snapshot) return false
		updateSelected((entry) => applySnapshotToCamera(entry, snapshot))
		return true
	}, [
		isEditingDefaultCamera,
		requestSceneCameraSnapshot,
		setOpeningView,
		updateSelected
	])

	return {
		cameras,
		selectedCamera,
		defaultCameraId,
		isEditingDefaultCamera,
		canDeleteSelected,
		hotspotNameByCameraId,
		select,
		add,
		removeSelected,
		renameSelected,
		pinSelectedAsDefault,
		setFov,
		captureCurrentView
	}
}

export type SceneCameras = ReturnType<typeof useSceneCameras>
