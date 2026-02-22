import { useAtom } from 'jotai'
import { memo, useCallback } from 'react'

import {
	CAMERA_CONTROLS_FIELDS,
	CAMERA_FIELDS,
	defaultCameraOptions,
	defaultControlsOptions,
	type FieldConfig
} from './constants'
import { InfoTooltip } from '../../../../../components/info-tooltip'
import {
	cameraAtom,
	controlsAtom
} from '../../../../../lib/stores/scene-settings-store'
import {
	EnhancedSettingSlider,
	SettingToggle
} from '../../../settings-components'


/**
 * Memoized component for rendering a single control field slider
 * Following React best practices:
 * - rerender-memo: Memoize individual field components
 * - rerender-dependencies: Use primitive dependencies
 */
const ControlField = memo(
	({
		config,
		value,
		onUpdate,
		enabled
	}: {
		config: FieldConfig
		value: number
		onUpdate: (key: string, value: number) => void
		enabled?: boolean
	}) => (
		<EnhancedSettingSlider
			enabled={enabled}
			id={config.key}
			sliderProps={{
				min: config.min,
				max: config.max,
				step: config.step,
				value:
					value ??
					defaultControlsOptions[
						config.key as keyof typeof defaultControlsOptions
					],
				onChange: (newValue) => onUpdate(config.key, newValue)
			}}
			label={config.label}
			tooltip={config.tooltip}
			labelProps={{
				low: `${config.min}${config.unit || ''} - ${config.label.includes('Speed') ? 'Slow' : 'Min'}`,
				high: `${config.max}${config.unit || ''} - ${config.label.includes('Speed') ? 'Fast' : 'Max'}`
			}}
			formatValue={config.formatValue}
			valueMapping={config.valueMapping}
			allowDirectInput={true}
		/>
	)
)
ControlField.displayName = 'ControlField'

/**
 * Memoized component for rendering a single camera field slider
 */
const CameraField = memo(
	({
		config,
		value,
		onUpdate
	}: {
		config: FieldConfig
		value: number
		onUpdate: (key: string, value: number) => void
	}) => (
		<EnhancedSettingSlider
			id={config.key}
			sliderProps={{
				min: config.min,
				max: config.max,
				step: config.step,
				value:
					value ??
					defaultCameraOptions[config.key as keyof typeof defaultCameraOptions],
				onChange: (newValue) => onUpdate(config.key, newValue)
			}}
			label={config.label}
			tooltip={config.tooltip}
			labelProps={{
				low: `${config.min}${config.unit || ''}`,
				high: `${config.max}${config.unit || ''}`
			}}
			formatValue={config.formatValue}
			valueMapping={config.valueMapping}
			allowDirectInput={true}
		/>
	)
)
CameraField.displayName = 'CameraField'

/**
 * Camera Controls Settings Panel
 *
 * Following React best practices:
 * - rendering-hoist-jsx: Static field configs hoisted to constants.ts
 * - rerender-memo: Memoized component to prevent unnecessary re-renders
 * - rerender-functional-setstate: Using functional setState for stable callbacks
 * - js-cache-property-access: Centralized field definitions in constants
 */
const CameraControlsSettingsPanel = memo(() => {
	const [controls, setControls] = useAtom(controlsAtom)
	const [camera, setCamera] = useAtom(cameraAtom)

	// rerender-functional-setstate: Use functional setState for stable callbacks
	const handleControlUpdate = useCallback(
		(key: string, value: number) => {
			setControls((prev) => ({
				...prev,
				[key]: value
			}))
		},
		[setControls]
	)

	const handleCameraUpdate = useCallback(
		(key: string, value: number) => {
			// Use direct object assignment to work around complex CameraProps type
			setCamera((prev) => {
				const updated = Object.assign({}, prev)
				if (key === 'fov' || key === 'near' || key === 'far') {
					;(updated as Record<string, unknown>)[key] = value
				}
				return updated
			})
		},
		[setCamera]
	)

	const handleToggle = useCallback(
		(key: keyof typeof controls, enabled: boolean) => {
			setControls((prev) => ({
				...prev,
				[key]: enabled
			}))
		},
		[setControls]
	)

	return (
		<div className="space-y-4">
			<p className="px-2">
				Adjust camera controls for navigation and presentation of your 3D scene.
			</p>
			<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
				Configure orbit controls, zoom, rotation, and more for the best user
				experience.
			</small>

			{/* Camera Settings Section */}
			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Camera</p>
					<InfoTooltip content="Configure camera properties like field of view and clipping planes." />
				</div>

				{CAMERA_FIELDS.map((config) => (
					<CameraField
						key={config.key}
						config={config}
						value={camera[config.key as keyof typeof camera] as number}
						onUpdate={handleCameraUpdate}
					/>
				))}
			</div>

			{/* Camera Controls Section */}
			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Camera Controls</p>
					<InfoTooltip content="Configure how users can interact with the camera in your scene." />
				</div>

				<SettingToggle
					enabled={!!controls.enableZoom}
					onToggle={(enabled) => handleToggle('enableZoom', enabled)}
					title="Enable Zoom"
					description="Allow users to zoom in and out."
				/>

				<SettingToggle
					enabled={!!controls.autoRotate}
					onToggle={(enabled) => handleToggle('autoRotate', enabled)}
					title="Auto Rotate"
					description="Automatically rotate the camera around the model."
				/>

				{/* Dynamically render all control fields from configuration */}
				{CAMERA_CONTROLS_FIELDS.map((config) => {
					// Determine if the field should be enabled based on dependencies
					const isEnabled =
						config.key === 'autoRotateSpeed'
							? !!controls.autoRotate
							: config.key === 'zoomSpeed'
								? !!controls.enableZoom
								: true

					return (
						<ControlField
							key={config.key}
							config={config}
							value={controls[config.key as keyof typeof controls] as number}
							onUpdate={handleControlUpdate}
							enabled={isEnabled}
						/>
					)
				})}
			</div>
		</div>
	)
})

CameraControlsSettingsPanel.displayName = 'CameraControlsSettingsPanel'

export default CameraControlsSettingsPanel
