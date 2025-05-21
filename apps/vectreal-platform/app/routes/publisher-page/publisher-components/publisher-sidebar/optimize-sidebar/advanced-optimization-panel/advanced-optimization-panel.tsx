import { Object3D } from 'three'

import { SimplificationSettings } from './simplification-settings'
import { TextureSettings } from './texture-settings'
import {
	DedupSetting,
	NormalsSetting,
	QuantizeSetting
} from './toggle-settings'

interface AdvancedPanelProps {
	model?: Object3D
}

const AdvancedPanel: React.FC<AdvancedPanelProps> = (props) => {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<SimplificationSettings />
			<TextureSettings {...props} />

			<div className="space-y-6">
				<QuantizeSetting />
				<DedupSetting />
				<NormalsSetting />
			</div>
		</div>
	)
}

export default AdvancedPanel
