import { useAtom, useSetAtom } from 'jotai/react'
import { memo, useCallback, useEffect, useState } from 'react'

import {
	CameraDetail,
	CameraList,
	PathSettings,
	TransitionSettings
} from './camera-views'
import { useSceneCameras } from './use-scene-cameras'
import { cameraToolOpenRequestAtom } from '../../../../../lib/stores/publisher-config-store'
import { exitHotspotCameraAtom } from '../../../../../lib/stores/scene-settings-store'
import {
	DrillDown,
	DrillDownView,
	useDrillDownNavigation
} from '../../drill-down'

/**
 * Opens the camera another tool linked to, once, as the panel mounts. It goes
 * through `push` like a click on that camera's row, so focus lands on the
 * view's heading and Back returns it to the row.
 */
function OpenRequestedCamera() {
	const [request, setRequest] = useAtom(cameraToolOpenRequestAtom)
	const { push } = useDrillDownNavigation()

	useEffect(() => {
		if (!request) return
		setRequest(null)
		push('camera', `camera:${request}`)
	}, [request, setRequest, push])

	return null
}

/**
 * Stepping back out of a hotspot camera's view puts back the camera the
 * author had before. Closing the tool does too, and `ToolSidebar` owns that,
 * because the mode can be entered before this panel ever mounts.
 */
function useCameraToolPath() {
	const [path, setPath] = useState<string[]>([])
	const exitHotspotCamera = useSetAtom(exitHotspotCameraAtom)

	const onPathChange = useCallback(
		(next: string[]) => {
			if (!next.includes('camera')) exitHotspotCamera()
			setPath(next)
		},
		[exitHotspotCamera]
	)

	return { path, onPathChange }
}

const CameraControlsSettingsPanel = memo(() => {
	const { path, onPathChange } = useCameraToolPath()
	const cameras = useSceneCameras()

	return (
		<DrillDown path={path} onPathChange={onPathChange} rootTitle="Camera">
			<DrillDownView id="root">
				<OpenRequestedCamera />
				<CameraList cameras={cameras} />
			</DrillDownView>

			<DrillDownView
				id="camera"
				title={cameras.selectedCamera?.name || 'Unnamed camera'}
			>
				{/* The camera it showed is gone, so the view goes with it. */}
				<CameraDetail cameras={cameras} onDeleted={() => onPathChange([])} />
			</DrillDownView>

			<DrillDownView
				id="transitions"
				title="Transitions"
				caption="How the view moves when a viewer switches cameras."
			>
				<TransitionSettings />
			</DrillDownView>

			<DrillDownView
				id="path"
				title="Path settings"
				caption="How the smart path clears the model on its way to the next camera."
			>
				<PathSettings />
			</DrillDownView>
		</DrillDown>
	)
})

CameraControlsSettingsPanel.displayName = 'CameraControlsSettingsPanel'

export default CameraControlsSettingsPanel
