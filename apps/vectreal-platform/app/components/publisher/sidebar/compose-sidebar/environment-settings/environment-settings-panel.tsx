import {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentResolution
} from '@vctrl/viewer'
import { Label } from '@vctrl-ui/ui/label'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from '@vctrl-ui/ui/select'
import { useAtom } from 'jotai/react'
import { useCallback } from 'react'

import { InfoTooltip } from '../../../../'
import { environmentAtom } from '../../../../../lib/stores/scene-settings-store'
import { SettingSlider, SettingToggle } from '../../../settings-components'

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
		const category = preset.split('-')[0] // Get the category from the preset name
		if (!acc[category]) {
			acc[category] = []
		}
		acc[category].push(preset)
		return acc
	},
	{} as Record<string, EnvironmentKey[]>
)

const ENVIRONMENT_RESOLUTIONS: EnvironmentResolution[] = ['1k', '4k']

const DEFAULT_GROUND_VALUES = {
	radius: 125,
	scale: 25,
	height: 5
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

	const handleGroundChange = useCallback(
		(key: 'radius' | 'scale' | 'height', value: number) => {
			// Validate the input value based on constraints
			const validatedValue = Math.max(0, value) // Ensures value is never negative

			setEnvironment((prev) => {
				// Safely handle the ground property regardless of its current type
				const currentGround = typeof prev.ground === 'object' ? prev.ground : {}

				return {
					...prev,
					ground: {
						...currentGround,
						[key]: validatedValue
					}
				}
			})
		},
		[setEnvironment]
	)

	return (
		<div className="space-y-4">
			<p className="px-2">
				Configure the scene environment, lighting and ground settings.
			</p>
			<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
				Environment settings affect how your model appears through lighting,
				reflections, and background elements.
			</small>

			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Environment</p>
					<InfoTooltip content="Controls scene lighting and background, affecting reflections and model appearance." />
				</div>

				<Label>HDR Preset</Label>
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
					<Select
						value={environment.environmentResolution}
						onValueChange={(value) => {
							handleEnvironmentChange(
								'environmentResolution',
								value as EnvironmentResolution
							)
						}}
					>
						<SelectTrigger className="w-full capitalize">
							<SelectValue placeholder="Select Environment Resolution" />
						</SelectTrigger>
						<SelectContent>
							{ENVIRONMENT_RESOLUTIONS.map((option) => (
								<SelectItem key={option} value={option} className="capitalize">
									{option}{' '}
									<small className="text-muted-foreground text-xs">
										{option === '1k' ? '~1MB' : '~20MB'}
									</small>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<SettingSlider
					id="environment-intensity"
					sliderProps={{
						min: 0,
						max: 1,
						step: 0.01,
						value: environment.environmentIntensity || 1,
						onChange: (value) =>
							handleEnvironmentChange('environmentIntensity', value)
					}}
					label="Environment Intensity"
					tooltip="This controls how bright the environment map appears in the scene, affecting lighting and reflections."
					labelProps={{
						low: '0 - Off',
						high: '1 - Full Intensity'
					}}
					formatValue={(value) => value.toFixed(2)}
				/>

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

				<SettingSlider
					enabled={!!environment.background}
					id="environment-blur"
					sliderProps={{
						min: 0,
						max: 1,
						step: 0.01,
						value: environment.backgroundBlurriness || 0,
						onChange: (value) =>
							handleEnvironmentChange('backgroundBlurriness', value)
					}}
					label="Background Blurriness"
					tooltip="This controls the blurriness of the background when the environment map is set as the background."
					labelProps={{
						low: '0 - Sharp',
						high: '1 - Fully Blurred'
					}}
					formatValue={(value) => value.toFixed(2)}
				/>
				<SettingSlider
					enabled={!!environment.background}
					id="background-intensity"
					sliderProps={{
						min: 0,
						max: 1,
						step: 0.01,
						value: environment.backgroundIntensity || 1,
						onChange: (value) =>
							handleEnvironmentChange('backgroundIntensity', value)
					}}
					label="Background Intensity"
					tooltip="This controls the brightness of the background when the environment map is set as the background."
					labelProps={{
						low: '0 - Off',
						high: '1 - Full Intensity'
					}}
					formatValue={(value) => value.toFixed(2)}
				/>
			</div>
			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Ground</p>
					<InfoTooltip content="Adds a ground plane that creates a sense of placement." />
				</div>

				<SettingToggle
					enabled={!!environment.ground}
					onToggle={(enabled) =>
						setEnvironment((prev) => ({
							...prev,
							ground: enabled ? DEFAULT_GROUND_VALUES : false
						}))
					}
					title="Show Ground"
					description="Display a ground plane in the scene."
				/>
				<SettingSlider
					enabled={!!environment.ground}
					id="ground-radius"
					sliderProps={{
						min: 0,
						max: 250,
						step: 1,
						value:
							typeof environment.ground === 'object'
								? (environment.ground.radius ?? DEFAULT_GROUND_VALUES.radius)
								: DEFAULT_GROUND_VALUES.radius,
						onChange: (value) => handleGroundChange('radius', value)
					}}
					label="Ground Radius"
					tooltip="This controls the radius of the ground plane in the scene."
					labelProps={{
						low: '0 - No Ground',
						high: '250 - Max Size'
					}}
					formatValue={(value) => Number(value).toString()}
				/>
				<SettingSlider
					enabled={!!environment.ground}
					id="ground-scale"
					sliderProps={{
						min: 0,
						max: 50,
						step: 0.5,
						value:
							typeof environment.ground === 'object'
								? (environment.ground.scale ?? DEFAULT_GROUND_VALUES.scale)
								: DEFAULT_GROUND_VALUES.scale,
						onChange: (value) => handleGroundChange('scale', value)
					}}
					label="Environment Scale"
					tooltip="This controls the scale of the ground planes environment sphere."
					labelProps={{
						low: '0 - No Scale',
						high: '50 - Max Scale'
					}}
					formatValue={(value) => Number(value).toString()}
				/>
				<SettingSlider
					enabled={!!environment.ground}
					id="ground-height"
					sliderProps={{
						min: 0,
						max: 10,
						step: 0.1,
						value:
							typeof environment.ground === 'object'
								? (environment.ground.height ?? DEFAULT_GROUND_VALUES.height)
								: DEFAULT_GROUND_VALUES.height,
						onChange: (value) => handleGroundChange('height', value)
					}}
					label="Ground Height"
					tooltip="This controls the height of the ground plane in the environment sphere."
					labelProps={{
						low: '0 - No Height',
						high: '10 - Full Height'
					}}
					formatValue={(value) => Number(value).toString()}
				/>
			</div>
		</div>
	)
}

export default EnvironmentSettings
