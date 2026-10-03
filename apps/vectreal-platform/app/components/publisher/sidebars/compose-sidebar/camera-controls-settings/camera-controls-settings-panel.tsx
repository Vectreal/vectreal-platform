import { useAtom } from 'jotai/react'
import { memo, useEffect, useState } from 'react'

import {
	CameraDetail,
	CameraList,
	PathSettings,
	TransitionSettings
} from './camera-views'
import { useSceneCameras } from './use-scene-cameras'
import { cameraToolOpenRequestAtom } from '../../../../../lib/stores/publisher-config-store'
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

const CameraControlsSettingsPanel = memo(() => {
	const [path, setPath] = useState<string[]>([])
	const cameras = useSceneCameras()

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Camera">
			<DrillDownView id="root">
				<OpenRequestedCamera />
				<CameraList cameras={cameras} />
			</DrillDownView>

			<DrillDownView
				id="camera"
				title={cameras.selectedCamera?.name || 'Unnamed camera'}
			>
				{/* The camera it showed is gone, so the view goes with it. */}
				<CameraDetail cameras={cameras} onDeleted={() => setPath([])} />
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
