import {
	resolveHotspotMarkers,
	resolveSceneViewCameras
} from '@vctrl/viewer/hotspots'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import { redactSettingsForEmbed } from '../../../../../lib/domain/scene/embed-settings-policy'
import { shouldShowSceneViewReturn } from '../../../../../lib/domain/scene/scene-presentation'
import {
	cameraAtom,
	hotspotsAtom,
	presentationAtom
} from '../../../../../lib/stores/scene-settings-store'

/**
 * The author's say over the viewer's way back from a hotspot's camera
 * (`presentation.showSceneViewReturn`, where absent means shown).
 *
 * `available` asks whether a visitor can ever stand on a hotspot view, read
 * the way the viewer reads it: a drawn marker linking a camera that is a
 * hotspot's close-up rather than a view of the scene, with a view of the
 * scene left to go back to. Counted on the markers a
 * visitor gets, so a camera only an internal or hidden hotspot links, or a link
 * to a camera that no longer exists, offers no view to come back from.
 * Without one the setting would change nothing, so the control says so.
 */
export function useSceneViewReturnSetting() {
	const camera = useAtomValue(cameraAtom)
	const hotspots = useAtomValue(hotspotsAtom)
	const [presentation, setPresentation] = useAtom(presentationAtom)

	const available = useMemo(() => {
		// On what a visitor's viewer receives. The redaction drops internal
		// hotspots, and with them their claim on an untagged camera, which then
		// counts as a scene view to go back to.
		// The bake id only decides what shadows ship; hotspots do not depend on it.
		const published = redactSettingsForEmbed(
			{ camera, hotspots },
			{ bakeAssetId: null }
		)
		const cameras = published.camera?.cameras ?? []
		const publishedHotspots = published.hotspots ?? []
		const sceneViews = new Set(
			resolveSceneViewCameras(cameras, publishedHotspots).map(
				(entry) => entry.cameraId
			)
		)
		// The viewer draws the control only with a scene view to lead back to.
		if (sceneViews.size === 0) return false
		// The defaults leave out hidden hotspots, which visitors cannot click.
		return resolveHotspotMarkers(publishedHotspots).some(
			({ linkedCameraId }) =>
				linkedCameraId !== null &&
				!sceneViews.has(linkedCameraId) &&
				cameras.some((entry) => entry.cameraId === linkedCameraId)
		)
	}, [camera, hotspots])

	const setShown = useCallback(
		(showSceneViewReturn: boolean) => {
			setPresentation((previous) => ({ ...previous, showSceneViewReturn }))
		},
		[setPresentation]
	)

	return {
		shown: shouldShowSceneViewReturn(presentation),
		available,
		setShown
	}
}
