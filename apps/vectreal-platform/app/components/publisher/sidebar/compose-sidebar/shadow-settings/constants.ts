import { defaultShadowOptions } from '../../../../../constants/viewer-defaults'
import { ValueMapping } from '../../../../../lib/utils/value-mapping'
import { valueMappings } from '../../../../../lib/utils/value-mapping'

/**
 * Shadow field configurations
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

export const ACCUMULATIVE_FIELDS: FieldConfig[] = [
	{
		key: 'frames',
		label: 'Frames',
		min: 1,
		max: 100,
		step: 1,
		tooltip: 'Number of frames to accumulate for soft shadows.',
		formatValue: (value) => value.toFixed(0),
		valueMapping: valueMappings.quadratic
	},
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 0.1,
		max: 50,
		step: 0.01,
		tooltip: 'Overall scale of the shadow area.',
		formatValue: (value) => value.toFixed(2),
		valueMapping: valueMappings.log
	},
	{
		key: 'opacity',
		label: 'Opacity',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Shadow opacity.',
		formatValue: (value) => value.toFixed(2)
	}
]

export const ACCUMULATIVE_LIGHT_FIELDS: FieldConfig[] = [
	{
		key: 'amount',
		label: 'Lights Amount',
		min: 1,
		max: 12,
		step: 1,
		tooltip: 'Number of lights used for soft shadows.',
		formatValue: (value) => value.toFixed(0)
	},
	{
		key: 'radius',
		label: 'Light Radius',
		min: 0.1,
		max: 50,
		step: 0.1,
		tooltip: 'Radius of the light source.',
		formatValue: (value) => value.toFixed(1),
		valueMapping: valueMappings.log
	}
]

export const CONTACT_FIELDS: FieldConfig[] = [
	{
		key: 'opacity',
		label: 'Opacity',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Shadow opacity.',
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'blur',
		label: 'Blur',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Shadow blur amount. Higher values create softer shadows.',
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 0.1,
		max: 50,
		step: 0.01,
		tooltip:
			'Overall scale of the shadow area. Smaller values create tighter shadows.',
		formatValue: (value) => value.toFixed(2),
		valueMapping: valueMappings.quadratic
	}
]

/**
 * Default values from viewer package
 * Re-exported for convenience
 */
export { defaultShadowOptions }
