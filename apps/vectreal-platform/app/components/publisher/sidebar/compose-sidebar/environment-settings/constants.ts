import { defaultEnvOptions } from '../../../../../constants/viewer-defaults'

import {
	ValueMapping,
	valueMappings
} from '../../../../../lib/utils/value-mapping'

/**
 * Environment and ground field configurations
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
 * Ground field configurations
 */
export const GROUND_FIELDS: FieldConfig[] = [
	{
		key: 'radius',
		label: 'Ground Radius',
		min: 10,
		max: 500,
		step: 5,
		tooltip: 'Controls the size of the ground plane in the scene.',
		formatValue: (value) => value.toFixed(0),
		valueMapping: valueMappings.log
	},
	{
		key: 'scale',
		label: 'Environment Scale',
		min: 1,
		max: 100,
		step: 1,
		tooltip: "Controls the scale of the ground plane's environment sphere.",
		formatValue: (value) => value.toFixed(0),
		valueMapping: valueMappings.log
	},
	{
		key: 'height',
		label: 'Ground Height',
		min: 0.1,
		max: 20,
		step: 0.1,
		tooltip:
			'Controls the height of the ground plane in the environment sphere.',
		formatValue: (value) => value.toFixed(1),
		valueMapping: valueMappings.quadratic
	}
]

/**
 * Default ground values
 */
export const DEFAULT_GROUND_VALUES = {
	radius: 125,
	scale: 25,
	height: 5
}

/**
 * Default values from viewer package
 * Re-exported for convenience
 */
export { defaultEnvOptions }
