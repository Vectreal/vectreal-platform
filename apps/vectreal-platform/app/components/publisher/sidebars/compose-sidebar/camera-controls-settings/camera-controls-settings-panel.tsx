import { memo, useState } from 'react'

import {
	CameraDetail,
	CameraList,
	PathSettings,
	TransitionSettings
} from './camera-views'
import { useSceneCameras } from './use-scene-cameras'
import { DrillDown, DrillDownView } from '../../drill-down'

const CameraControlsSettingsPanel = memo(() => {
	const [path, setPath] = useState<string[]>([])
	const cameras = useSceneCameras()

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Camera">
			<DrillDownView id="root">
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
