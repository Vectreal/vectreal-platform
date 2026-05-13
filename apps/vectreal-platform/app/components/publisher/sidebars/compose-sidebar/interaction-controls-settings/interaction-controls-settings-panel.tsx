import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Separator } from '@shared/components/ui/separator'
import { useAtom } from 'jotai/react'
import { memo, useCallback, useState } from 'react'

import { controlsAtom } from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import {
	EnhancedSettingSlider,
	SettingToggle
} from '../../../settings-components'
import { PresetButton } from '../../../settings-components/preset-button'
import { CollapsibleSectionTrigger } from '../../accordion-components'
import { CAMERA_CONTROLS_FIELDS, defaultControlsOptions } from '../camera-controls-settings/constants'

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
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Controls
					</p>
					<InfoTooltip content="Configure which interactions viewers can use with the 3D scene." />
				</div>
				<Separator />

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
			</div>

			{/* ── Movement feel ───────────────────────────────────────── */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Feel
					</p>
					<InfoTooltip content="Controls how the camera decelerates when you release the mouse. Lower values feel floatier; higher values snap to a stop." />
				</div>
				<Separator />

				<div className="space-y-1.5">
					<p className="text-xs text-muted-foreground">Movement Feel</p>
					<div className="grid grid-cols-3 gap-1.5">
						{SMOOTHNESS_PRESETS.map((preset) => (
							<PresetButton
								key={preset.label}
								label={preset.label}
								isActive={closestSmoothness === preset.value}
								onClick={() => handleUpdate('dampingFactor', preset.value)}
							/>
						))}
					</div>
				</div>
			</div>

			{/* ── Interaction speeds ──────────────────────────────────── */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Speeds
					</p>
					<InfoTooltip content="Fine-tune the speed of each interaction type. Speeds for disabled controls are greyed out." />
				</div>
				<Separator />

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
			</div>
		</div>
	)
})

InteractionControlsSettingsPanel.displayName = 'InteractionControlsSettingsPanel'

export default InteractionControlsSettingsPanel
