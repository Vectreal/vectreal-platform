import type { ValueMapping } from '../lib/utils/value-mapping'

/**
 * Shared field configuration for inspector slider settings.
 * Single source of truth - import from here in all constants files.
 */
export interface FieldConfig {
	key: string
	label: string
	min: number
	max: number
	step: number
	tooltip: string
	formatValue?: (value: number) => string
	valueMapping?: ValueMapping
	unit?: string
}
