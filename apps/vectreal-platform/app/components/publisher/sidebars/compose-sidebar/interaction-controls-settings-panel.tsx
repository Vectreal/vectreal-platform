import { Button } from '@shared/components/ui/button'
import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { useAtom } from 'jotai/react'
import {
	Eye,
	Focus,
	Gauge,
	Route,
	RotateCw,
	SlidersHorizontal,
	ZoomIn
} from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import {
	INTERACTION_FEELS,
	type InteractionFeel
} from '../../../../constants/viewer-defaults'
import { shouldShowInteractionHint } from '../../../../lib/domain/scene/scene-presentation'
import {
	controlsAtom,
	presentationAtom
} from '../../../../lib/stores/scene-settings-store'
import { PREVIEW_TOGGLE_ID } from '../../shell/tool-bar'
import { usePreviewToggle } from '../../shell/use-preview-toggle'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../drill-down'
import { FieldSlider } from '../field-slider'
import { SettingGroup, SidebarSection } from '../sidebar-section'
import { TRANSITION_TYPE_OPTIONS } from './camera-controls-settings/camera-state'
import {
	CAMERA_CONTROLS_FIELDS,
	defaultControlsOptions
} from './camera-controls-settings/constants'
import { TransitionSettings } from './camera-controls-settings/transition-settings'
import { useCameraSwitcherSetting } from './camera-controls-settings/use-camera-switcher-setting'
import { useSceneTransition } from './camera-controls-settings/use-scene-transition'
import { StartMovingSetting } from './start-moving-setting'
import { useSceneViewReturnSetting } from './use-scene-view-return-setting'

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
	const { enterPreview } = usePreviewToggle()
	const [presentation, setPresentation] = useAtom(presentationAtom)
	const switcher = useCameraSwitcherSetting()
	const sceneViewReturn = useSceneViewReturnSetting()
	const { transition } = useSceneTransition()
	const transitionLabel = TRANSITION_TYPE_OPTIONS.find(
		(option) => option.value === transition.type
	)?.label
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
			<DrillDownView
				id="root"
				caption="These settings apply to visitors and in Preview. The editor always moves freely."
			>
				<SidebarSection title="Moving">
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
						<Toggle
							layout="tile"
							label="Double-click focus"
							icon={<Focus />}
							checked={!!controls.focusOnDoubleClick}
							onCheckedChange={(enabled) =>
								setControl('focusOnDoubleClick', enabled)
							}
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
						<DrillDownTrigger
							to="fine-tune"
							icon={<Gauge />}
							label="Fine-tune"
						/>
						<DrillDownTrigger
							to="advanced"
							icon={<SlidersHorizontal />}
							label="Advanced"
						/>
					</div>
				</SidebarSection>

				<SidebarSection title="Starting">
					<StartMovingSetting />
					<Toggle
						checked={shouldShowInteractionHint(presentation)}
						onCheckedChange={(showInteractionHint) =>
							setPresentation((previous) => ({
								...previous,
								showInteractionHint
							}))
						}
						label="Show how to interact"
						description="Tells visitors how to move the scene, briefly, when it first appears. Applies to embeds and preview links as soon as you save."
					/>
				</SidebarSection>

				<SidebarSection title="Between cameras">
					<Toggle
						label="Camera switcher"
						description={
							switcher.available
								? 'Lets visitors step between the cameras in the published scene.'
								: 'Shown once the scene has two cameras to switch between.'
						}
						checked={switcher.shown}
						disabled={!switcher.available}
						onCheckedChange={switcher.setShown}
					/>
					<DrillDownTrigger
						to="transitions"
						icon={<Route />}
						label="Transitions"
						summary={transitionLabel}
					/>
					<Toggle
						checked={sceneViewReturn.shown}
						onCheckedChange={sceneViewReturn.setShown}
						disabled={!sceneViewReturn.available}
						label="Back to scene view"
						description={
							sceneViewReturn.available
								? 'Offers visitors a way back, by button or Escape, after a hotspot flies the camera to its own view. Applies to embeds and preview links as soon as you save.'
								: 'Shown once a hotspot has its own camera.'
						}
					/>
				</SidebarSection>

				<Button
					variant="secondary"
					className="w-full"
					onClick={async () => {
						await enterPreview()
						// Preview closes this panel with the button in it; focus goes to
						// the toggle that leaves preview again.
						requestAnimationFrame(() =>
							document.getElementById(PREVIEW_TOGGLE_ID)?.focus()
						)
					}}
				>
					<Eye className="size-4" />
					Try in Preview
				</Button>
			</DrillDownView>

			<DrillDownView
				id="transitions"
				title="Transitions"
				caption="How the view moves when a visitor switches cameras."
			>
				<TransitionSettings />
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
