import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { useAtom } from 'jotai/react'
import { memo, useCallback, useState } from 'react'

import { controlsAtom } from '../../../../lib/stores/scene-settings-store'
import {
	EnhancedSettingSlider,
	SettingToggle,
	ToggleButtonGroup
} from '../../settings-components'
import { CollapsibleSectionTrigger } from '../accordion-components'
import {
	SettingGroup,
	SidebarSection,
	SidebarSectionContent
} from '../sidebar-section'
import {
	CAMERA_CONTROLS_FIELDS,
	defaultControlsOptions
} from './camera-controls-settings/constants'

// ─── Constants ───────────────────────────────────────────────────────────────

const SMOOTHNESS_PRESETS = [
	{ label: 'Floaty', value: 0.02 },
	{ label: 'Balanced', value: 0.1 },
	{ label: 'Snappy', value: 0.4 }
]

const SPEED_KEYS = ['rotateSpeed', 'panSpeed', 'zoomSpeed', 'autoRotateSpeed']
const ADVANCED_KEYS = ['maxPolarAngle']

function getClosestPreset<T extends { value: number }>(
	presets: T[],
	current: number
): number {
	let closest = presets[0].value
	let minDiff = Math.abs(current - presets[0].value)
	for (const preset of presets) {
		const diff = Math.abs(current - preset.value)
		if (diff < minDiff) {
			minDiff = diff
			closest = preset.value
		}
	}
	return closest
}

// ─── Panel ───────────────────────────────────────────────────────────────────

const InteractionControlsSettingsPanel = memo(() => {
	const [controls, setControls] = useAtom(controlsAtom)
	const [advancedOpen, setAdvancedOpen] = useState(false)

	const handleToggle = useCallback(
		(key: keyof typeof controls, enabled: boolean) => {
			setControls((prev) => ({ ...prev, [key]: enabled }))
		},
		[setControls]
	)

	const handleUpdate = useCallback(
		(key: string, value: number) => {
			setControls((prev) => ({ ...prev, [key]: value }))
		},
		[setControls]
	)

	const currentDamping = (controls.dampingFactor as number) ?? 0.1
	const closestSmoothness = getClosestPreset(SMOOTHNESS_PRESETS, currentDamping)

	const speedFields = CAMERA_CONTROLS_FIELDS.filter((f) =>
		SPEED_KEYS.includes(f.key)
	)
	const advancedFields = CAMERA_CONTROLS_FIELDS.filter((f) =>
		ADVANCED_KEYS.includes(f.key)
	)

	return (
		<div className="space-y-6">
			{/* ── Enable toggles ──────────────────────────────────────── */}
			<SidebarSection
				title="Controls"
				tooltip="Configure which interactions viewers can use with the 3D scene."
			>
				<SidebarSectionContent>
					<SettingToggle
						enabled={!!controls.enableZoom}
						onToggle={(enabled) => handleToggle('enableZoom', enabled)}
						title="Enable Zoom"
						description="Allow viewers to zoom in and out."
					/>

					<SettingToggle
						enabled={!!controls.autoRotate}
						onToggle={(enabled) => handleToggle('autoRotate', enabled)}
						title="Auto Rotate"
						description="Continuously orbit the camera around the model."
					/>
				</SidebarSectionContent>
			</SidebarSection>

			{/* ── Movement feel ───────────────────────────────────────── */}
			<SidebarSection
				title="Feel"
				tooltip="Controls how the camera decelerates when you release the mouse. Lower values feel floatier; higher values snap to a stop."
			>
				<SidebarSectionContent>
					<SettingGroup label="Movement Feel">
						<ToggleButtonGroup
							options={SMOOTHNESS_PRESETS}
							isActive={(value) => closestSmoothness === value}
							onChange={(value) => handleUpdate('dampingFactor', value)}
						/>
					</SettingGroup>
				</SidebarSectionContent>
			</SidebarSection>

			{/* ── Interaction speeds ──────────────────────────────────── */}
			<SidebarSection
				title="Speeds"
				tooltip="Fine-tune the speed of each interaction type. Speeds for disabled controls are greyed out."
			>
				<SidebarSectionContent>
					{speedFields.map((config) => {
						const isEnabled =
							config.key === 'autoRotateSpeed'
								? !!controls.autoRotate
								: config.key === 'zoomSpeed'
									? !!controls.enableZoom
									: true

						return (
							<EnhancedSettingSlider
								key={config.key}
								enabled={isEnabled}
								id={config.key}
								sliderProps={{
									min: config.min,
									max: config.max,
									step: config.step,
									value:
										(controls[config.key as keyof typeof controls] as number) ??
										(defaultControlsOptions[
											config.key as keyof typeof defaultControlsOptions
										] as number),
									onChange: (value) => handleUpdate(config.key, value)
								}}
								label={config.label}
								tooltip={config.tooltip}
								labelProps={{
									low: `${config.min} – Slow`,
									high: `${config.max} – Fast`
								}}
								formatValue={config.formatValue}
								valueMapping={config.valueMapping}
								allowDirectInput
							/>
						)
					})}

					<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
						<CollapsibleSectionTrigger isOpen={advancedOpen}>
							Advanced
						</CollapsibleSectionTrigger>
						<CollapsibleContent className="space-y-4 pt-3">
							{advancedFields.map((config) => (
								<EnhancedSettingSlider
									key={config.key}
									id={config.key}
									sliderProps={{
										min: config.min,
										max: config.max,
										step: config.step,
										value:
											(controls[
												config.key as keyof typeof controls
											] as number) ??
											(defaultControlsOptions[
												config.key as keyof typeof defaultControlsOptions
											] as number),
										onChange: (value) => handleUpdate(config.key, value)
									}}
									label={config.label}
									tooltip={config.tooltip}
									labelProps={{
										low: `${config.min}`,
										high: `${((config.max * 180) / Math.PI).toFixed(0)}°`
									}}
									formatValue={config.formatValue}
									valueMapping={config.valueMapping}
									allowDirectInput
								/>
							))}
						</CollapsibleContent>
					</Collapsible>
				</SidebarSectionContent>
			</SidebarSection>
		</div>
	)
})

InteractionControlsSettingsPanel.displayName =
	'InteractionControlsSettingsPanel'

export default InteractionControlsSettingsPanel
