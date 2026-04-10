import { defaultEnvOptions } from '../../../../../constants/viewer-defaults'
import {
	ValueMapping,
	valueMappings
} from '../../../../../lib/utils/value-mapping'

/**
 * Environment field configurations
 * Based on defaults from @vctrl/viewer package
 *
 * Following React best practices:
 * - rendering-hoist-jsx: Static configuration hoisted outside component
 * - js-cache-property-access: Centralized field definitions
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
}

/**
 * Environment field configurations
 * Using defaults from defaultEnvOptions
 */
export const ENVIRONMENT_FIELDS: FieldConfig[] = [
	{
		key: 'environmentIntensity',
		label: 'Environment Intensity',
		min: 0,
		max: 5,
		step: 0.01,
		tooltip:
			'Controls how bright the environment map appears, affecting lighting and reflections.',
		formatValue: (value) => value.toFixed(2),
		valueMapping: valueMappings.quadratic
	},
	{
		key: 'backgroundBlurriness',
		label: 'Background Blurriness',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip:
			'Controls the blurriness of the background when environment is visible.',
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'backgroundIntensity',
		label: 'Background Intensity',
		min: 0,
		max: 3,
		step: 0.01,
		tooltip:
			'Controls the brightness of the background when environment is visible.',
		formatValue: (value) => value.toFixed(2),
		valueMapping: valueMappings.quadratic
	}
]

/**
 * Default values from viewer package
 * Re-exported for convenience
 */
export { defaultEnvOptions }
