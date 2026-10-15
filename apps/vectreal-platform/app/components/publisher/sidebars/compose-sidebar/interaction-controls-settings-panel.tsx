import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { useAtom } from 'jotai/react'
import { Gauge, RotateCw, SlidersHorizontal, ZoomIn } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import {
	CAMERA_CONTROLS_FIELDS,
	defaultControlsOptions
} from './camera-controls-settings/constants'
import {
	INTERACTION_FEELS,
	type InteractionFeel
} from '../../../../constants/viewer-defaults'
import { controlsAtom } from '../../../../lib/stores/scene-settings-store'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../drill-down'
import { FieldSlider } from '../field-slider'
import { SettingGroup } from '../sidebar-section'

import type { FieldConfig } from '../../../../types/settings-field'
import type { ControlsProps } from '@vctrl/core'

const FEEL_LABELS: Record<InteractionFeel, string> = {
	floaty: 'Floaty',
	balanced: 'Balanced',
	snappy: 'Snappy'
}

const FINE_TUNE_KEYS = [
	'dampingFactor',
	'rotateSpeed',
	'panSpeed',
	'zoomSpeed',
	'autoRotateSpeed'
]
const ADVANCED_KEYS = ['maxPolarAngle']

const fineTuneFields = FINE_TUNE_KEYS.flatMap((key) =>
	CAMERA_CONTROLS_FIELDS.filter((field) => field.key === key)
)
const advancedFields = CAMERA_CONTROLS_FIELDS.filter((field) =>
	ADVANCED_KEYS.includes(field.key)
)

/** The feel whose every value the controls carry, or '' once any is tuned. */
function matchingFeel(controls: ControlsProps): InteractionFeel | '' {
	const feels = Object.entries(INTERACTION_FEELS) as [
		InteractionFeel,
		(typeof INTERACTION_FEELS)[InteractionFeel]
	][]
	const match = feels.find(([, values]) =>
		Object.entries(values).every(
			([key, value]) =>
				Math.abs(
					((controls[key as keyof ControlsProps] as number | undefined) ??
						NaN) - value
				) < 1e-6
		)
	)
	return match?.[0] ?? ''
}

const InteractionControlsSettingsPanel = memo(() => {
	const [controls, setControls] = useAtom(controlsAtom)
	const [path, setPath] = useState<string[]>([])
	const feel = matchingFeel(controls)

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
					label="Feel"
					description={
						feel
							? 'How closely the scene follows a viewer dragging it.'
							: 'Custom. Pick a feel to replace the fine-tuned values.'
					}
				>
					<ToggleGroup
						type="single"
						aria-label="Feel"
						value={feel}
						onValueChange={(next) => {
							if (!next) return
							setControls((prev) => ({
								...prev,
								enableDamping: true,
								...INTERACTION_FEELS[next as InteractionFeel]
							}))
						}}
					>
						{(Object.keys(FEEL_LABELS) as InteractionFeel[]).map((key) => (
							<ToggleGroupItem key={key} value={key}>
								{FEEL_LABELS[key]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</SettingGroup>

				<div className="space-y-2">
					<DrillDownTrigger to="fine-tune" icon={<Gauge />} label="Fine-tune" />
					<DrillDownTrigger
						to="advanced"
						icon={<SlidersHorizontal />}
						label="Advanced"
					/>
				</div>
			</DrillDownView>

			<DrillDownView
				id="fine-tune"
				title="Fine-tune"
				caption="Responsiveness is how closely the camera tracks the pointer. Settings for interactions that are off are disabled."
			>
				{fineTuneFields.map((field) =>
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
