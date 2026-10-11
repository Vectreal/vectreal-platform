import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { valueMappings } from '@shared/utils'
import {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentResolution
} from '@vctrl/core'
import { useAtom } from 'jotai/react'
import { Image as ImageIcon } from 'lucide-react'
import { useCallback, useState } from 'react'

import {
	type BackgroundMode,
	backgroundModeOf,
	withBackgroundMode
} from './background-mode'
import StageColorField from './stage-color-field'
import { environmentAtom } from '../../../../../lib/stores/scene-settings-store'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../../drill-down'
import { SettingGroup } from '../../sidebar-section'

const ENVIRONMENT_PRESETS: EnvironmentKey[] = [
	'nature-moonlit',
	'nature-park',
	'nature-park-overcast',
	'nature-snow',
	'night-building',
	'night-city',
	'night-pure-sky',
	'night-stars',
	'outdoor-golden-hour',
	'outdoor-noon',
	'outdoor-overcast',
	'outdoor-sky',
	'studio-key',
	'studio-natural',
	'studio-soft'
]

const GROUPED_ENVIRONMENT_PRESETS = ENVIRONMENT_PRESETS.reduce(
	(acc, preset) => {
		const category = preset.split('-')[0]
		if (!acc[category]) {
			acc[category] = []
		}
		acc[category].push(preset)
		return acc
	},
	{} as Record<string, EnvironmentKey[]>
)

const RESOLUTION_OPTIONS: EnvironmentResolution[] = ['1k', '4k']

const LIGHTING_PRESETS: SliderPreset[] = [
	{ value: 0.3, label: 'Dim' },
	{ value: 1, label: 'Normal' },
	{ value: 2.5, label: 'Bright' }
]

const BG_BLUR_PRESETS: SliderPreset[] = [
	{ value: 0, label: 'Sharp' },
	{ value: 0.3, label: 'Soft' },
	{ value: 0.8, label: 'Blurred' }
]

const BG_BRIGHTNESS_PRESETS: SliderPreset[] = [
	// Not 0: the value is read with `|| 1`, so a stored 0 would come back as 1.
	{ value: 0.001, label: 'Off' },
	{ value: 1, label: 'Normal' },
	{ value: 2, label: 'Bright' }
]

const BACKGROUND_MODES: {
	value: BackgroundMode
	label: string
	summary: string
}[] = [
	{ value: 'environment', label: 'HDRI', summary: 'Environment' },
	{ value: 'color', label: 'Color', summary: 'Color' },
	{ value: 'gradient', label: 'Gradient', summary: 'Gradient' },
	{ value: 'none', label: 'None', summary: 'Transparent' }
]

const BACKGROUND_CAPTIONS: Record<BackgroundMode, string> = {
	environment:
		'The environment map fills the view behind the model. It has no floor, so a shadow has nothing to land on.',
	color:
		'A flat stage behind the model, for its shadow to land on. The environment map still lights it.',
	gradient:
		'A stage that shades from top to bottom, for the shadow to land on. The environment map still lights it.',
	none: 'Nothing behind the model: an embed shows the page it sits on.'
}

const EnvironmentSettings = () => {
	const [environment, setEnvironment] = useAtom(environmentAtom)
	const [path, setPath] = useState<string[]>([])
	const backgroundMode = backgroundModeOf(environment)
	const backdrop = environment.backdrop

	// From the latest state, not this render's: the system color picker sends
	// a change per frame while it is dragged, and the two gradient stops are
	// one value.
	const setGradientStop = useCallback(
		(stop: 'top' | 'bottom', color: string) =>
			setEnvironment((prev) =>
				prev.backdrop?.type === 'gradient'
					? { ...prev, backdrop: { ...prev.backdrop, [stop]: color } }
					: prev
			),
		[setEnvironment]
	)

	const handleEnvironmentChange = useCallback(
		(
			key: keyof EnvironmentProps,
			setting: EnvironmentProps[keyof EnvironmentProps]
		) => {
			setEnvironment((prev) => ({
				...prev,
				[key]: setting
			}))
		},
		[setEnvironment]
	)

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Environment">
			<DrillDownView id="root">
				<SettingGroup label="HDR preset">
					<div className="grid grid-cols-[1fr_auto] gap-2">
						<Select
							value={environment.preset}
							onValueChange={(value) => {
								handleEnvironmentChange('preset', value as EnvironmentKey)
							}}
						>
							<SelectTrigger className="w-full min-w-0 capitalize">
								<SelectValue placeholder="Select Environment Preset" />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(GROUPED_ENVIRONMENT_PRESETS).map(
									([group, presets]) => (
										<SelectGroup key={group}>
											<SelectLabel className="capitalize">{group}</SelectLabel>
											{presets.map((preset) => (
												<SelectItem
													key={preset}
													value={preset}
													className="capitalize"
												>
													{preset.toString().split('-').slice(1).join(' ')}
												</SelectItem>
											))}
											<SelectSeparator />
										</SelectGroup>
									)
								)}
							</SelectContent>
						</Select>

						<ToggleGroup
							type="single"
							aria-label="Environment resolution"
							value={environment.environmentResolution}
							onValueChange={(value) => {
								if (value) {
									handleEnvironmentChange(
										'environmentResolution',
										value as EnvironmentResolution
									)
								}
							}}
							className="w-auto"
						>
							{RESOLUTION_OPTIONS.map((resolution) => (
								<ToggleGroupItem key={resolution} value={resolution}>
									{resolution}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</div>
				</SettingGroup>

				<Slider
					label="Lighting"
					min={0}
					max={5}
					step={0.01}
					mapping={valueMappings.quadratic}
					presets={LIGHTING_PRESETS}
					value={environment.environmentIntensity || 1}
					onValueChange={(value) =>
						handleEnvironmentChange('environmentIntensity', value)
					}
				/>

				<DrillDownTrigger
					to="background"
					icon={<ImageIcon />}
					label="Background"
					summary={
						BACKGROUND_MODES.find((mode) => mode.value === backgroundMode)
							?.summary
					}
				/>
			</DrillDownView>

			<DrillDownView
				id="background"
				title="Background"
				caption={BACKGROUND_CAPTIONS[backgroundMode]}
			>
				<ToggleGroup
					type="single"
					aria-label="Background"
					value={backgroundMode}
					onValueChange={(value) => {
						if (value)
							setEnvironment((prev) =>
								withBackgroundMode(prev, value as BackgroundMode)
							)
					}}
				>
					{BACKGROUND_MODES.map((mode) => (
						<ToggleGroupItem key={mode.value} value={mode.value}>
							{mode.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>

				{backgroundMode === 'environment' && (
					<>
						<Slider
							label="Blur"
							min={0}
							max={1}
							step={0.01}
							presets={BG_BLUR_PRESETS}
							value={environment.backgroundBlurriness || 0}
							onValueChange={(value) =>
								handleEnvironmentChange('backgroundBlurriness', value)
							}
						/>

						<Slider
							label="Brightness"
							min={0}
							max={3}
							step={0.01}
							mapping={valueMappings.quadratic}
							presets={BG_BRIGHTNESS_PRESETS}
							value={environment.backgroundIntensity || 1}
							onValueChange={(value) =>
								handleEnvironmentChange('backgroundIntensity', value)
							}
						/>
					</>
				)}

				{backgroundMode === 'color' && backdrop?.type === 'color' && (
					<StageColorField
						label="Color"
						value={backdrop.color}
						onChange={(color) =>
							handleEnvironmentChange('backdrop', { type: 'color', color })
						}
					/>
				)}

				{backgroundMode === 'gradient' && backdrop?.type === 'gradient' && (
					<>
						<StageColorField
							label="Top"
							value={backdrop.top}
							onChange={(top) => setGradientStop('top', top)}
						/>
						<StageColorField
							label="Bottom"
							value={backdrop.bottom}
							onChange={(bottom) => setGradientStop('bottom', bottom)}
						/>
					</>
				)}
			</DrillDownView>
		</DrillDown>
	)
}

export default EnvironmentSettings
