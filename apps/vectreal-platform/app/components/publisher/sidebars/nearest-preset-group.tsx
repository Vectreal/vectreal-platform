import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'

import type { SliderPreset } from '@shared/components/ui/slider'

/** The preset nearest a value that may have been set to anything. */
export function closestPreset(
	presets: readonly SliderPreset[],
	value: number
): SliderPreset {
	return presets.reduce((closest, preset) =>
		Math.abs(preset.value - value) < Math.abs(closest.value - value)
			? preset
			: closest
	)
}

interface NearestPresetGroupProps {
	/** The group's accessible name. */
	label: string
	presets: readonly SliderPreset[]
	value: number
	onChange: (value: number) => void
	className?: string
}

/**
 * A numeric setting offered as a few named presets. A saved value between
 * them selects the nearest one, so the group always shows a choice.
 */
export function NearestPresetGroup({
	label,
	presets,
	value,
	onChange,
	className
}: NearestPresetGroupProps) {
	return (
		<ToggleGroup
			type="single"
			aria-label={label}
			value={closestPreset(presets, value).label}
			onValueChange={(next) => {
				const preset = presets.find((entry) => entry.label === next)
				if (preset) onChange(preset.value)
			}}
			className={className}
		>
			{presets.map((preset) => (
				<ToggleGroupItem key={preset.label} value={preset.label}>
					{preset.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	)
}
