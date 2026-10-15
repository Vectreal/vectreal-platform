import {
	resolveSceneViewCameras,
	shouldShowCameraControls
} from '@vctrl/viewer/hotspots'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import { normalizeCameraState, withDefaultCameraFlag } from './camera-state'
import { redactSettingsForEmbed } from '../../../../../lib/domain/scene/embed-settings-policy'
import {
	cameraAtom,
	hotspotsAtom
} from '../../../../../lib/stores/scene-settings-store'

/**
 * The author's say over the viewer's camera switcher (`camera.showControls`,
 * where absent means shown).
 *
 * `available` asks the viewer's own rule whether the scene has views enough to
 * switch between, counted the way the viewer counts them (a hotspot's camera
 * is its close-up, not a view) and on what a visitor's viewer receives: the
 * embed drops internal-only hotspots, so a camera only they link counts as a
 * view there. Below that the setting would change nothing, so the control
 * says so rather than offering a switch with no effect.
 */
export function useCameraSwitcherSetting() {
	const [camera, setCamera] = useAtom(cameraAtom)
	const hotspots = useAtomValue(hotspotsAtom)

	const available = useMemo(() => {
		// The bake id only decides what shadows ship; cameras do not depend on it.
		const published = redactSettingsForEmbed(
			{ camera, hotspots },
			{ bakeAssetId: null }
		)
		return shouldShowCameraControls({
			sceneViewCount: resolveSceneViewCameras(
				published.camera?.cameras,
				published.hotspots ?? []
			).length,
			authorAllows: true,
			hostAllows: true
		})
	}, [camera, hotspots])

	const setShown = useCallback(
		(showControls: boolean) => {
			setCamera((prev) =>
				withDefaultCameraFlag({ ...normalizeCameraState(prev), showControls })
			)
		},
		[setCamera]
	)

	return { shown: camera.showControls !== false, available, setShown }
}
