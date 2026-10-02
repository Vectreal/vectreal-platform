import type { ValueMapping } from '@shared/utils'

/**
 * One slider setting in a publisher panel, rendered by `FieldSlider`.
 * `Key` names the setting it writes, so a panel can type its own keys.
 */
export interface FieldConfig<Key extends string = string> {
	key: Key
	label: string
	min: number
	max: number
	step: number
	formatValue?: (value: number) => string
	valueMapping?: ValueMapping
}
