import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { DEFAULT_SCENE_TRANSITION } from '@vctrl/core'

import { SettingGroup } from '../../sidebar-section'
import {
	TRANSITION_EASING_OPTIONS,
	TRANSITION_TYPE_OPTIONS
} from './camera-state'
import { useSceneTransition } from './use-scene-transition'

import type { CameraTransitionEasing, CameraTransitionType } from '@vctrl/core'

const DURATION_PRESETS: SliderPreset[] = [
	{ value: 0, label: 'Instant' },
	{ value: 500, label: 'Quick' },
	{ value: 2000, label: 'Slow' }
]

/** How the view moves when a viewer switches cameras. */
export function TransitionSettings() {
	const { transition, setType, setDuration, setEasing } = useSceneTransition()

	return (
		<>
			<ToggleGroup
				type="single"
				aria-label="Transition type"
				value={transition.type}
				onValueChange={(value) => {
					if (value) setType(value as CameraTransitionType)
				}}
			>
				{TRANSITION_TYPE_OPTIONS.map((option) => (
					<ToggleGroupItem key={option.value} value={option.value}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			{transition.type !== 'none' && (
				<>
					<Slider
						label="Duration"
						min={0}
						max={5000}
						step={50}
						presets={DURATION_PRESETS}
						formatValue={(value) => `${Math.round(value)} ms`}
						value={transition.duration ?? DEFAULT_SCENE_TRANSITION.duration}
						onValueChange={setDuration}
					/>

					<SettingGroup label="Easing">
						<ToggleGroup
							type="single"
							aria-label="Transition easing"
							value={transition.easing ?? DEFAULT_SCENE_TRANSITION.easing}
							onValueChange={(value) => {
								if (value) setEasing(value as CameraTransitionEasing)
							}}
							className="grid grid-cols-2"
						>
							{TRANSITION_EASING_OPTIONS.map((option) => (
								<ToggleGroupItem key={option.value} value={option.value}>
									{option.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</SettingGroup>
				</>
			)}
		</>
	)
}
