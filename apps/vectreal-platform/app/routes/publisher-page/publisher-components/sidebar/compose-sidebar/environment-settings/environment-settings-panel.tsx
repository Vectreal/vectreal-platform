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
import { useCallback, useEffect } from 'react'

import { environmentAtom } from '../../../../../../lib/stores/publisher-config-store'

const environmentPresets: EnvironmentKey[] = [
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

const groupedEnvironmentPresets = environmentPresets.reduce(
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

const environmentResolutions: EnvironmentResolution[] = ['1k', '4k']

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
		[]
	)

	return (
		<div className="w-full">
			<div className="space-y-2">
				<p className="px-2">
					Either select a preset or go to the advanced optimization options.
				</p>
				<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
					After configuring you need to apply the optimizations to see the
					changes.
				</small>
				<div className="space-y-3">
					<Label htmlFor="texture-size">Environment map</Label>

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
								{Object.entries(groupedEnvironmentPresets).map(
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
								{environmentResolutions.map((option) => (
									<SelectItem
										key={option}
										value={option}
										className="capitalize"
									>
										{option}{' '}
										<small className="text-muted-foreground text-xs">
											{option === '1k' ? '~1MB' : '~20MB'}
										</small>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</div>
	)
}

export default EnvironmentSettings
