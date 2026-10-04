import { useCallback, useMemo, useRef, useState } from 'react'

import {
	nextReturnCameraId,
	resolveActiveHotspot,
	resolveReturnCameraId
} from '../components/scene/scene-view-return'

import type { HotspotMarker } from '../components/scene/resolve-hotspot-markers'
import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const NO_HOTSPOTS: readonly HotspotDefinition[] = []

interface UseSceneViewReturnOptions {
	cameras: CameraConfig[] | undefined
	/**
	 * Every hotspot the scene stores, drawn or not. An untagged camera any of
	 * them links is a close-up, never a place to return to.
	 */
	hotspots: readonly HotspotDefinition[] | undefined
	/** The markers this surface draws, resolved as `SceneHotspots` resolves them. */
	markers: readonly HotspotMarker[]
	/** The camera the view is on now, from the viewer's camera events. */
	activeCameraId: null | string
	activateCamera: (cameraId: string) => void
}

export interface SceneViewReturn {
	/**
	 * The hotspot whose camera the view is on, when there is somewhere to go
	 * back to. Null whenever the way back would lead nowhere: the view is not
	 * on a hotspot camera, or the scene has no other camera to return to.
	 */
	hotspot: HotspotMarker | null
	/** Records a camera the view landed on. Hotspot cameras are ignored. */
	noteCamera: (cameraId: null | string) => void
	/** Flies back. Returns whether it did, so a key handler knows to claim the key. */
	returnToSceneView: () => boolean
}

/**
 * Remembers the scene camera a visitor left for a hotspot, and takes them back.
 *
 * Fed from the viewer's interaction funnel rather than from the marker click,
 * so a host's `focus_hotspot` or `activate_camera` and a `?camera=` link are
 * all covered by the same memory.
 */
export function useSceneViewReturn({
	cameras,
	hotspots,
	markers,
	activeCameraId,
	activateCamera
}: UseSceneViewReturnOptions): SceneViewReturn {
	const [recorded, setRecorded] = useState<null | string>(null)

	// Read at event time rather than closed over, so `noteCamera` stays stable
	// for the interaction funnel that calls it.
	const links = hotspots ?? NO_HOTSPOTS
	const latest = useRef({ cameras, links })
	latest.current = { cameras, links }

	const noteCamera = useCallback((cameraId: null | string) => {
		setRecorded((previous) =>
			nextReturnCameraId(
				previous,
				cameraId,
				latest.current.cameras,
				latest.current.links
			)
		)
	}, [])

	const { hotspot, target } = useMemo(() => {
		const active = resolveActiveHotspot(activeCameraId, cameras, links, markers)
		const returnCameraId = resolveReturnCameraId(recorded, cameras, links)
		// The target can never be the active camera: a hotspot camera is never a
		// return candidate, and `active` exists only on one.
		const available = active !== null && returnCameraId !== null
		return available
			? { hotspot: active, target: returnCameraId }
			: { hotspot: null, target: null }
	}, [activeCameraId, cameras, links, markers, recorded])

	// A command can arrive between renders; it acts on the latest answer.
	const targetRef = useRef(target)
	targetRef.current = target

	const returnToSceneView = useCallback(() => {
		const cameraId = targetRef.current
		if (!cameraId) return false
		activateCamera(cameraId)
		return true
	}, [activateCamera])

	return { hotspot, noteCamera, returnToSceneView }
}
