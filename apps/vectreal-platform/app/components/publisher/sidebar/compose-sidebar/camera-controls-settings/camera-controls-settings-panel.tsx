import { useAtom } from 'jotai'

import { InfoTooltip } from '../../../../../components/info-tooltip'
import { controlsAtom } from '../../../../../lib/stores/scene-settings-store'
import { SettingSlider, SettingToggle } from '../../../settings-components'

const CameraControlsSettingsPanel = () => {
	const [controls, setControls] = useAtom(controlsAtom)

	return (
		<div className="space-y-4">
			<p className="px-2">
				Adjust camera controls for navigation and presentation of your 3D scene.
			</p>
			<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
				Configure orbit controls, zoom, rotation, and more for the best user
				experience.
			</small>

			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Camera Controls</p>
					<InfoTooltip content="Configure how users can interact with the camera in your scene." />
				</div>

				<SettingToggle
					enabled={!!controls.enableZoom}
					onToggle={(enabled) =>
						setControls((prev) => ({
							...prev,
							enableZoom: enabled
						}))
					}
					title="Enable Zoom"
					description="Allow users to zoom in and out."
				/>

				<SettingToggle
					enabled={!!controls.autoRotate}
					onToggle={(enabled) =>
						setControls((prev) => ({
							...prev,
							autoRotate: enabled
						}))
					}
					title="Auto Rotate"
					description="Automatically rotate the camera around the model."
				/>

				<SettingSlider
					enabled={!!controls.autoRotate}
					id="auto-rotate-speed"
					sliderProps={{
						min: 0,
						max: 2,
						step: 0.01,
						value: controls.autoRotateSpeed ?? 0.5,
						onChange: (value) =>
							setControls((prev) => ({
								...prev,
								autoRotateSpeed: value
							}))
					}}
					label="Auto Rotate Speed"
					tooltip="Speed at which the camera auto-rotates."
					labelProps={{
						low: '0 - Off',
						high: '2 - Fast'
					}}
					formatValue={(value) => value.toFixed(2)}
				/>

				<SettingSlider
					id="damping-factor"
					sliderProps={{
						min: 0,
						max: 0.5,
						step: 0.01,
						value: controls.dampingFactor ?? 0.25,
						onChange: (value) =>
							setControls((prev) => ({
								...prev,
								dampingFactor: value
							}))
					}}
					label="Damping Factor"
					tooltip="Smoothness of camera movement."
					labelProps={{
						low: '0 - Fully Damped',
						high: '0.5 - No Damping'
					}}
					formatValue={(value) => value.toFixed(2)}
				/>
			</div>
		</div>
	)
}

export default CameraControlsSettingsPanel
