import { deriveUniqueSlug } from '@shared/utils'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import {
	cameraElevation,
	cameraLimits,
	withElevationInTilt
} from '../../../../../lib/domain/scene/camera-limits'
import {
	applySceneCameraMove,
	isLastSceneCamera,
	partitionSceneCameras,
	resolveDefaultSceneCameraId,
	type SceneCameraMove
} from '../../../../../lib/domain/scene/scene-camera'
import {
	interactionSwitchesTo,
	removeCamera
} from '../../../../../lib/domain/scene/scene-hotspot-camera-links'
import {
	viewLensAtom,
	viewMovedAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	controlsAtom,
	exitHotspotCameraAtom,
	hotspotCameraModeAtom,
	hotspotsAtom,
	interactionsAtom,
	selectCameraAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import { useOpeningViewCapture } from '../../../shell/use-opening-view'
import { hotspotDisplayName } from '../hotspot-settings/use-hotspot-edits'
import { describeCameraRemoval } from './camera-removal-notice'
import {
	applySnapshotToCamera,
	normalizeCameraState,
	resolveEditorTargetCameraId,
	withDefaultCameraFlag,
	type CameraEntry
} from './camera-state'
import { defaultCameraOptions } from './constants'
import { publishedSceneViewCameras } from './use-camera-switcher-setting'

import type { CameraConstraints } from '@vctrl/core'

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
	const [interactions, setInteractions] = useAtom(interactionsAtom)
	const { requestSceneCameraSnapshot, commandExecutor } =
		usePublisherViewerCapture()
	const [isViewMoved, setViewMoved] = useAtom(viewMovedAtom)
	const [viewLens, setViewLens] = useAtom(viewLensAtom)
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
	/** The cameras the published switcher steps through; the list orders only these. */
	const viewIds = useMemo(
		() =>
			new Set(
				publishedSceneViewCameras(normalizedCamera, hotspots).map(
					(entry) => entry.cameraId
				)
			),
		[normalizedCamera, hotspots]
	)
	const { sceneCameras, otherCameras } = useMemo(
		() => partitionSceneCameras(cameras, viewIds),
		[cameras, viewIds]
	)
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

	const sceneControls = useAtomValue(controlsAtom)
	/** What the selected camera holds a visitor to now (`cameraLimits`). */
	const limits = selectedCamera
		? cameraLimits(selectedCamera, sceneControls)
		: undefined

	/**
	 * Writes the selected camera's own limits. Its tilt range always takes in
	 * the view it is saved at, so a visitor arriving there is not moved.
	 */
	const setLimits = useCallback(
		(next: CameraConstraints) =>
			updateSelected((entry) => ({
				...entry,
				constraints: withElevationInTilt(next, cameraElevation(entry, hotspots))
			})),
		[hotspots, updateSelected]
	)

	/** Gives every camera, hotspot cameras too, the selected camera's limits. */
	const applyLimitsToAll = useCallback(() => {
		if (!limits) return
		setCamera((prev) => {
			const normalized = normalizeCameraState(prev)
			return {
				...normalized,
				cameras: (normalized.cameras ?? []).map((entry) => ({
					...entry,
					constraints: withElevationInTilt(
						limits,
						cameraElevation(entry, hotspots)
					)
				}))
			}
		})
	}, [hotspots, limits, setCamera])

	/**
	 * On the camera, a new lens is the camera's, and the view takes it where it
	 * is. Once the author has moved off it, the lens is tried out on the view
	 * alone until the view is saved into a camera.
	 */
	const setFov = useCallback(
		(fov: number) => {
			if (isViewMoved) setViewLens(fov)
			else updateSelected((entry) => ({ ...entry, fov }))
		},
		[isViewMoved, setViewLens, updateSelected]
	)

	/** Drops a moved view and flies back to the camera as saved. */
	const backToCamera = useCallback(() => {
		commandExecutor.current?.execute({
			type: 'activate_camera',
			cameraId: editorTargetCameraId
		})
	}, [commandExecutor, editorTargetCameraId])

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
			{ camera: normalizedCamera, hotspots, interactions },
			editorTargetCameraId
		)
		if (!next) return

		const notice = describeCameraRemoval(
			hotspots
				.filter((hotspot) => hotspot.linkedCameraId === editorTargetCameraId)
				.map(hotspotDisplayName),
			(interactions ?? []).filter((interaction) =>
				interactionSwitchesTo(interaction, editorTargetCameraId)
			).length
		)

		// Landing on the first survivor would select a hotspot's camera whenever
		// one sits ahead of the remaining scene cameras, and the editor treats
		// whatever is selected as the camera "Set camera to current view" writes.
		const nextCamera = {
			...next.camera,
			activeCameraId: resolveDefaultSceneCameraId(next.camera.cameras)
		}

		setCamera(nextCamera)
		setHotspots(next.hotspots)
		setInteractions(next.interactions)
		if (notice) toast.info(notice)
		// Deleting the hotspot camera the mode stands on ends the mode the way
		// closing the tool would, back where the author started.
		if (hotspotCameraMode) exitHotspotCamera()
		else selectCamera(nextCamera.activeCameraId ?? '')
	}, [
		editorTargetCameraId,
		exitHotspotCamera,
		hotspotCameraMode,
		hotspots,
		interactions,
		normalizedCamera,
		selectCamera,
		setCamera,
		setHotspots,
		setInteractions
	])

	/**
	 * Renaming changes the name and nothing else. The id stays the one the
	 * camera was created with: hotspot links, interactions and embed hosts
	 * calling `activate_camera` all name it, and a selection that moved with
	 * the id flew the view back to the camera's saved pose.
	 */
	const renameSelected = useCallback(
		(nextName: string) => {
			const id = selectedCamera?.cameraId
			if (!id) return

			setCamera((prev) => {
				const normalized = normalizeCameraState(prev)
				return withDefaultCameraFlag({
					...normalized,
					cameras: (normalized.cameras ?? []).map((entry) =>
						entry.cameraId === id ? { ...entry, name: nextName } : entry
					)
				})
			})
		},
		[selectedCamera?.cameraId, setCamera]
	)

	/**
	 * Puts the scene cameras in a new order, which is the order the switcher
	 * steps through; the first is where the scene opens. Resolves to where the
	 * moved camera landed, or null when the order is not a move.
	 *
	 * The capture out of the updater is safe because `cameraAtom` is a jotai
	 * primitive, whose write runs the updater once and synchronously. The
	 * annotated type keeps TypeScript from narrowing `applied` to `never`
	 * after its null guard, since it cannot see the updater run.
	 */
	const reorder = useCallback(
		(order: string[], movedId: string): SceneCameraMove<CameraEntry> | null => {
			let applied: SceneCameraMove<CameraEntry> | null = null
			setCamera((prev) => {
				const normalized = normalizeCameraState(prev)
				applied = applySceneCameraMove(
					normalized.cameras ?? [],
					order,
					movedId,
					viewIds
				)
				return applied
					? withDefaultCameraFlag({ ...normalized, cameras: applied.cameras })
					: prev
			})
			return applied
		},
		[setCamera, viewIds]
	)

	/** "Move to top": the selected camera becomes the one the scene opens on. */
	const moveSelectedToTop = useCallback(() => {
		const targetId = selectedCamera?.cameraId
		if (!targetId) return null
		return reorder([targetId], targetId)
	}, [reorder, selectedCamera?.cameraId])

	/**
	 * Pointing the default camera somewhere new moves the frame the scene opens
	 * on, and the thumbnail is the placeholder shown while loading resolves into
	 * that frame. Capturing both together is what stops the load from jumping.
	 * Other cameras are navigational and leave the opening view alone.
	 *
	 * Resolves to whether a view was captured.
	 */
	const captureCurrentView = useCallback(async (): Promise<boolean> => {
		let captured: boolean
		if (isEditingDefaultCamera) {
			captured = await setOpeningView()
		} else {
			const snapshot = await requestSceneCameraSnapshot()
			if (snapshot) {
				updateSelected((entry) => applySnapshotToCamera(entry, snapshot))
			}
			captured = !!snapshot
		}
		// The camera now holds the view, lens included: it is on the camera.
		if (captured) {
			setViewMoved(false)
			setViewLens(null)
		}
		return captured
	}, [
		isEditingDefaultCamera,
		requestSceneCameraSnapshot,
		setOpeningView,
		setViewLens,
		setViewMoved,
		updateSelected
	])

	return {
		cameras,
		sceneCameras,
		otherCameras,
		selectedCamera,
		defaultCameraId,
		isEditingDefaultCamera,
		canDeleteSelected,
		hotspotNameByCameraId,
		select,
		add,
		removeSelected,
		renameSelected,
		reorder,
		moveSelectedToTop,
		setFov,
		captureCurrentView,
		limits,
		setLimits,
		applyLimitsToAll,
		/** Whether the view has moved off the selected camera. */
		isViewMoved,
		/** The lens on screen: a moved view's own, else the camera's. */
		viewFov: (isViewMoved ? viewLens : null) ?? selectedCamera?.fov,
		backToCamera
	}
}

export type SceneCameras = ReturnType<typeof useSceneCameras>
