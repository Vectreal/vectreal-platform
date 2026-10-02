import { Toggle } from '@shared/components/ui/toggle'
import { useAtom } from 'jotai/react'
import { Gauge, RotateCw, SlidersHorizontal, ZoomIn } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import {
	CAMERA_CONTROLS_FIELDS,
	defaultControlsOptions
} from './camera-controls-settings/constants'
import { controlsAtom } from '../../../../lib/stores/scene-settings-store'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../drill-down'
import { FieldSlider } from '../field-slider'
import { NearestPresetGroup } from '../nearest-preset-group'
import { SettingGroup } from '../sidebar-section'

import type { FieldConfig } from '../../../../types/settings-field'
import type { SliderPreset } from '@shared/components/ui/slider'

const SMOOTHNESS_PRESETS: SliderPreset[] = [
	{ label: 'Floaty', value: 0.02 },
	{ label: 'Balanced', value: 0.1 },
	{ label: 'Snappy', value: 0.4 }
]

const SPEED_KEYS = ['rotateSpeed', 'panSpeed', 'zoomSpeed', 'autoRotateSpeed']
const ADVANCED_KEYS = ['maxPolarAngle']

const speedFields = CAMERA_CONTROLS_FIELDS.filter((field) =>
	SPEED_KEYS.includes(field.key)
)
const advancedFields = CAMERA_CONTROLS_FIELDS.filter((field) =>
	ADVANCED_KEYS.includes(field.key)
)

const InteractionControlsSettingsPanel = memo(() => {
	const [controls, setControls] = useAtom(controlsAtom)
	const [path, setPath] = useState<string[]>([])

	const setControl = useCallback(
		(key: string, value: boolean | number) => {
			setControls((prev) => ({ ...prev, [key]: value }))
		},
		[setControls]
	)

	const valueOf = (field: FieldConfig) =>
		(controls[field.key as keyof typeof controls] as number) ??
		(defaultControlsOptions[
			field.key as keyof typeof defaultControlsOptions
		] as number)

	const renderField = (field: FieldConfig, disabled = false) => (
		<FieldSlider
			key={field.key}
			field={field}
			value={valueOf(field)}
			onChange={setControl}
			disabled={disabled}
		/>
	)

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Interaction">
			<DrillDownView id="root">
				<div className="grid grid-cols-3 gap-2">
					<Toggle
						layout="tile"
						label="Zoom"
						icon={<ZoomIn />}
						checked={!!controls.enableZoom}
						onCheckedChange={(enabled) => setControl('enableZoom', enabled)}
					/>
					<Toggle
						layout="tile"
						label="Auto rotate"
						icon={<RotateCw />}
						checked={!!controls.autoRotate}
						onCheckedChange={(enabled) => setControl('autoRotate', enabled)}
					/>
				</div>

				<SettingGroup
					label="Movement feel"
					description="How the camera slows down after a viewer lets go."
				>
					<NearestPresetGroup
						label="Movement feel"
						presets={SMOOTHNESS_PRESETS}
						value={(controls.dampingFactor as number) ?? 0.1}
						onChange={(value) => setControl('dampingFactor', value)}
					/>
				</SettingGroup>

				<div className="space-y-2">
					<DrillDownTrigger to="speeds" icon={<Gauge />} label="Speeds" />
					<DrillDownTrigger
						to="advanced"
						icon={<SlidersHorizontal />}
						label="Advanced"
					/>
				</div>
			</DrillDownView>

			<DrillDownView
				id="speeds"
				title="Speeds"
				caption="How fast each interaction moves. Speeds for interactions that are off are disabled."
			>
				{speedFields.map((field) =>
					renderField(
						field,
						(field.key === 'autoRotateSpeed' && !controls.autoRotate) ||
							(field.key === 'zoomSpeed' && !controls.enableZoom)
					)
				)}
			</DrillDownView>

			<DrillDownView
				id="advanced"
				title="Advanced"
				caption="How far viewers can orbit over the top of the model."
			>
				{advancedFields.map((field) => renderField(field))}
			</DrillDownView>
		</DrillDown>
	)
})

InteractionControlsSettingsPanel.displayName =
	'InteractionControlsSettingsPanel'

export default InteractionControlsSettingsPanel
