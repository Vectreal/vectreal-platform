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
import { Toggle } from '@shared/components/ui/toggle'
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

const EnvironmentSettings = () => {
	const [environment, setEnvironment] = useAtom(environmentAtom)
	const [path, setPath] = useState<string[]>([])

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
					summary={environment.background ? 'Shown' : 'Hidden'}
				/>
			</DrillDownView>

			<DrillDownView
				id="background"
				title="Background"
				caption="Show the environment map behind the model, and how it looks there."
			>
				<div className="grid grid-cols-3 gap-2">
					<Toggle
						layout="tile"
						label="Show"
						icon={<ImageIcon />}
						checked={!!environment.background}
						onCheckedChange={(enabled) =>
							handleEnvironmentChange('background', enabled)
						}
					/>
				</div>

				<Slider
					label="Blur"
					min={0}
					max={1}
					step={0.01}
					presets={BG_BLUR_PRESETS}
					disabled={!environment.background}
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
					disabled={!environment.background}
					value={environment.backgroundIntensity || 1}
					onValueChange={(value) =>
						handleEnvironmentChange('backgroundIntensity', value)
					}
				/>
			</DrillDownView>
		</DrillDown>
	)
}

export default EnvironmentSettings
