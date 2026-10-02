import { Slider } from '@shared/components/ui/slider'

import type { FieldConfig } from '../../../types/settings-field'

interface FieldSliderProps<Key extends string> {
	field: FieldConfig<Key>
	value: number
	onChange: (key: Key, value: number) => void
	disabled?: boolean
}

/** A `FieldConfig` as a `Slider`, writing back under the field's key. */
export function FieldSlider<Key extends string>({
	field,
	value,
	onChange,
	disabled
}: FieldSliderProps<Key>) {
	return (
		<Slider
			label={field.label}
			min={field.min}
			max={field.max}
			step={field.step}
			mapping={field.valueMapping}
			formatValue={field.formatValue}
			disabled={disabled}
			value={value}
			onValueChange={(next) => onChange(field.key, next)}
		/>
	)
}
