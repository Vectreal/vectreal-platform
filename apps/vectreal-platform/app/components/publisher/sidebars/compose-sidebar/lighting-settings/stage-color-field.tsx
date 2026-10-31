import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'

import { SettingGroup } from '../../sidebar-section'

/**
 * Studio neutrals. A stage is there for the shadow to land on, so the presets
 * stay out of the product's way; any other color is one click further.
 */
const STAGE_SWATCHES = [
	{ color: '#ffffff', label: 'White' },
	{ color: '#f4f4f5', label: 'Light gray' },
	{ color: '#d4d4d8', label: 'Gray' },
	{ color: '#3f3f46', label: 'Graphite' },
	{ color: '#18181b', label: 'Black' }
] as const

interface StageColorFieldProps {
	label: string
	/** `#rrggbb`. */
	value: string
	onChange: (color: string) => void
}

/** One stage color: a preset swatch, or any color from the system picker. */
const StageColorField = ({ label, value, onChange }: StageColorFieldProps) => {
	const preset = STAGE_SWATCHES.find(
		(swatch) => swatch.color === value.toLowerCase()
	)

	return (
		<SettingGroup label={label} value={value.toUpperCase()}>
			<div className="grid grid-cols-[1fr_auto] gap-2">
				<ToggleGroup
					type="single"
					aria-label={`${label} preset`}
					value={preset?.color ?? ''}
					onValueChange={(color) => {
						if (color) onChange(color)
					}}
				>
					{STAGE_SWATCHES.map((swatch) => (
						<ToggleGroupItem
							key={swatch.color}
							value={swatch.color}
							aria-label={swatch.label}
							title={swatch.label}
						>
							{/*
							  The ring takes the item's text color, which inverts with the
							  selected fill, so a white swatch still has an edge on the
							  light track and on the filled segment alike.
							*/}
							<span
								aria-hidden
								className="size-4 rounded-full ring-1 ring-current/30"
								style={{ background: swatch.color }}
							/>
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<input
					type="color"
					aria-label={`${label}, custom`}
					title="Custom color"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="ds-field focus-visible:outline-ring size-10 cursor-pointer appearance-none rounded-xl p-2 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
				/>
			</div>
		</SettingGroup>
	)
}

export default StageColorField
