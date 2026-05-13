import { Label } from '@shared/components/ui/label'
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
import { Separator } from '@shared/components/ui/separator'
import {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentResolution
} from '@vctrl/core'
import { useAtom } from 'jotai/react'
import { useCallback } from 'react'

import { InfoTooltip } from '../../../..'
import { environmentAtom } from '../../../../../lib/stores/scene-settings-store'
import {
	PresetButton,
	SettingToggle,
	ToggleButtonGroup
} from '../../../settings-components'

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
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					HDR Environment
				</p>
				<InfoTooltip content="Controls scene lighting and background, affecting reflections and model appearance." />
			</div>
			<Separator />

			<Label>HDR Preset</Label>
			<div className="flex items-stretch gap-2">
				<Select
					value={environment.preset}
					onValueChange={(value) => {
						handleEnvironmentChange('preset', value as EnvironmentKey)
					}}
				>
					<SelectTrigger className="flex-1 capitalize">
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
				<div className="flex gap-1.5">
					{RESOLUTION_OPTIONS.map((opt) => (
						<PresetButton
							key={opt.value}
							label={opt.label}
							isActive={
								(environment.environmentResolution ?? '1k') === opt.value
							}
							onClick={() =>
								handleEnvironmentChange('environmentResolution', opt.value)
							}
						/>
					))}
				</div>
			</div>

			<div className="space-y-1.5">
				<p className="text-muted-foreground text-xs">Lighting Strength</p>
				<ToggleButtonGroup
					options={LIGHTING_OPTIONS}
					isActive={(v) =>
						getClosestValue(
							LIGHTING_OPTIONS,
							environment.environmentIntensity ?? 1
						) === v
					}
					onChange={(v) => handleEnvironmentChange('environmentIntensity', v)}
				/>
			</div>

			<p className="text-muted-foreground pt-1 text-xs font-medium">
				Background
			</p>

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

			<div
				className={`space-y-1.5 ${!environment.background ? 'pointer-events-none opacity-40' : ''}`}
			>
				<p className="text-muted-foreground text-xs">Background Blur</p>
				<ToggleButtonGroup
					options={BG_BLUR_OPTIONS}
					isActive={(v) =>
						getClosestValue(
							BG_BLUR_OPTIONS,
							environment.backgroundBlurriness ?? 0
						) === v
					}
					onChange={(v) => handleEnvironmentChange('backgroundBlurriness', v)}
				/>
			</div>

			<div
				className={`space-y-1.5 ${!environment.background ? 'pointer-events-none opacity-40' : ''}`}
			>
				<p className="text-muted-foreground text-xs">Background Brightness</p>
				<ToggleButtonGroup
					options={BG_BRIGHTNESS_OPTIONS}
					isActive={(v) =>
						getClosestValue(
							BG_BRIGHTNESS_OPTIONS,
							environment.backgroundIntensity ?? 1
						) === v
					}
					onChange={(v) => handleEnvironmentChange('backgroundIntensity', v)}
				/>
			</div>
		</div>
	)
}

export default EnvironmentSettings
