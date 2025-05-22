import { SimplificationSettings } from './simplification-settings'
import { TextureSettings } from './texture-settings'
import {
	DedupSetting,
	NormalsSetting,
	QuantizeSetting
} from './toggle-settings'

const AdvancedPanel: React.FC = () => {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<SimplificationSettings />
			<TextureSettings />

			<div className="space-y-6">
				<QuantizeSetting />
				<DedupSetting />
				<NormalsSetting />
			</div>
		</div>
	)
}

export default AdvancedPanel
