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
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentResolution
} from '@vctrl/core'
import { useAtom } from 'jotai/react'
import { useCallback } from 'react'

import { environmentAtom } from '../../../../../lib/stores/scene-settings-store'
import { valueMappings } from '../../../../../lib/utils/value-mapping'
import {
	EnhancedSettingSlider,
	PresetButton,
	SettingToggle,
	ToggleButtonGroup
} from '../../../settings-components'
import {
	SidebarSection,
	SidebarSectionContent,
	SettingRow,
	SettingGroup
} from '../../sidebar-section'

import type { ToggleButtonGroupOption } from '../../../settings-components'

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

const RESOLUTION_OPTIONS: ToggleButtonGroupOption<EnvironmentResolution>[] = [
	{ value: '1k', label: '1k' },
	{ value: '4k', label: '4k' }
]

const LIGHTING_OPTIONS: ToggleButtonGroupOption<number>[] = [
	{ value: 0.3, label: 'Dim' },
	{ value: 1, label: 'Normal' },
	{ value: 2.5, label: 'Bright' }
]

const BG_BLUR_OPTIONS: ToggleButtonGroupOption<number>[] = [
	{ value: 0, label: 'Sharp' },
	{ value: 0.3, label: 'Soft' },
	{ value: 0.8, label: 'Blurred' }
]

const BG_BRIGHTNESS_OPTIONS: ToggleButtonGroupOption<number>[] = [
	{ value: 0, label: 'Off' },
	{ value: 1, label: 'Normal' },
	{ value: 2, label: 'Bright' }
]

function getClosestValue(
	options: ToggleButtonGroupOption<number>[],
	current: number
): number {
	return options.reduce((closest, o) =>
		Math.abs(o.value - current) < Math.abs(closest.value - current)
			? o
			: closest
	).value
}

const EnvironmentSettings = () => {
	const [environment, setEnvironment] = useAtom(environmentAtom)
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
		<SidebarSection
			title="HDR Environment"
			tooltip="Controls scene lighting and background, affecting reflections and model appearance."
		>
			<SidebarSectionContent>
				{/* HDR Preset */}
				<SettingGroup label="HDR Preset">
					<div className="grid grid-cols-[4fr_1fr] gap-2">
						<Select
							value={environment.preset}
							onValueChange={(value) => {
								handleEnvironmentChange('preset', value as EnvironmentKey)
							}}
						>
							<SelectTrigger className="w-full capitalize">
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
							value={environment.environmentResolution ?? '1k'}
							onValueChange={(value) => {
								if (value)
									handleEnvironmentChange(
										'environmentResolution',
										value as EnvironmentResolution
									)
							}}
							variant="outline"
							className="h-9"
						>
							<ToggleGroupItem value="1k" className="px-3 text-xs">
								1k
							</ToggleGroupItem>
							<ToggleGroupItem value="4k" className="px-3 text-xs">
								4k
							</ToggleGroupItem>
						</ToggleGroup>
					</div>
				</SettingGroup>

				{/* Lighting Strength */}
				<SettingRow label="Lighting Strength">
					<EnhancedSettingSlider
						id="environment-intensity"
						sliderProps={{
							min: 0,
							max: 5,
							step: 0.01,
							value: environment.environmentIntensity || 1,
							onChange: (value) =>
								handleEnvironmentChange('environmentIntensity', value)
						}}
						label="Lighting Strength"
						tooltip="Controls how bright the environment map appears, affecting lighting and reflections."
						labelProps={{
							low: '0 - Off',
							high: '5 - Very Bright'
						}}
						formatValue={(value) => value.toFixed(2)}
						valueMapping={valueMappings.quadratic}
						allowDirectInput={true}
					/>
				</SettingRow>

				{/* Background Toggle */}
				<SettingToggle
					enabled={!!environment.background}
					onToggle={(enabled) =>
						setEnvironment((prev) => ({
							...prev,
							background: enabled
						}))
					}
					title="Show as background"
					description="Display the environment map as the background of the scene."
					info="This will set the environment map as the background of the scene, allowing it to be visible behind the model."
				/>

				{/* Background Blur */}
				{environment.background && (
					<SettingRow label="Background Blur">
						<EnhancedSettingSlider
							id="environment-blur"
							sliderProps={{
								min: 0,
								max: 1,
								step: 0.01,
								value: environment.backgroundBlurriness || 0,
								onChange: (value) =>
									handleEnvironmentChange('backgroundBlurriness', value)
							}}
							label="Background Blur"
							tooltip="Controls the blurriness of the background when environment is visible."
							labelProps={{
								low: '0 - Sharp',
								high: '1 - Fully Blurred'
							}}
							formatValue={(value) => value.toFixed(2)}
							allowDirectInput={true}
						/>
					</SettingRow>
				)}

				{/* Background Brightness */}
				{environment.background && (
					<SettingRow label="Background Brightness">
						<EnhancedSettingSlider
							id="background-intensity"
							sliderProps={{
								min: 0,
								max: 3,
								step: 0.01,
								value: environment.backgroundIntensity || 1,
								onChange: (value) =>
									handleEnvironmentChange('backgroundIntensity', value)
							}}
							label="Background Brightness"
							tooltip="Controls the brightness of the background when environment is visible."
							labelProps={{
								low: '0 - Off',
								high: '3 - Very Bright'
							}}
							formatValue={(value) => value.toFixed(2)}
							valueMapping={valueMappings.quadratic}
							allowDirectInput={true}
						/>
					</SettingRow>
				)}
			</SidebarSectionContent>
		</SidebarSection>
	)
}

export default EnvironmentSettings
