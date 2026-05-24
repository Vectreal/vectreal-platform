import { defaultShadowOptions } from '../../../../../constants/viewer-defaults'
import { valueMappings } from '../../../../../lib/utils/value-mapping'

import type { FieldConfig } from '../../../../../types/settings-field'

export type { FieldConfig }

// ─── Contact shadow fields ───────────────────────────────────────────────────

/** Primary contact shadow controls shown by default */
export const CONTACT_PRIMARY_FIELDS: FieldConfig[] = [
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
	}
]

/**
 * Advanced contact shadow controls - hidden in collapsed section.
 * Scale defaults are intentionally large in viewer-defaults to avoid
 * shadow-plane floor clipping on most scenes.
 */
export const CONTACT_ADVANCED_FIELDS: FieldConfig[] = [
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 0.1,
		max: 50,
		step: 0.01,
		tooltip:
			'Overall scale of the shadow projection plane. Keep large to avoid floor clipping.',
		formatValue: (value) => value.toFixed(2),
		valueMapping: valueMappings.quadratic
	}
]

// ─── Accumulative (soft) shadow fields ──────────────────────────────────────

/** Primary soft shadow controls shown by default */
export const ACCUMULATIVE_PRIMARY_FIELDS: FieldConfig[] = [
	{
		key: 'frames',
		label: 'Sample Count',
		min: 1,
		max: 100,
		step: 1,
		tooltip:
			'Number of sample frames accumulated to produce soft shadows. Higher values produce softer shadows but are slower to compute.',
		formatValue: (value) => value.toFixed(0),
		valueMapping: valueMappings.quadratic
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

/**
 * Advanced soft shadow controls - scale + light config.
 * Scale defaults large to avoid shadow-plane floor clipping.
 */
export const ACCUMULATIVE_ADVANCED_FIELDS: FieldConfig[] = [
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 0.1,
		max: 50,
		step: 0.01,
		tooltip:
			'Overall scale of the shadow projection plane. Keep large to avoid floor clipping.',
		formatValue: (value) => value.toFixed(2),
		valueMapping: valueMappings.log
	}
]

/** Light source config for soft shadows (inside advanced section) */
export const ACCUMULATIVE_LIGHT_FIELDS: FieldConfig[] = [
	{
		key: 'amount',
		label: 'Lights',
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

// ─── Legacy aliases - kept so old imports continue to resolve ────────────────
/** @deprecated Use CONTACT_PRIMARY_FIELDS + CONTACT_ADVANCED_FIELDS instead */
export const CONTACT_FIELDS: FieldConfig[] = [
	...CONTACT_PRIMARY_FIELDS,
	...CONTACT_ADVANCED_FIELDS
]

/** @deprecated Use ACCUMULATIVE_PRIMARY_FIELDS + ACCUMULATIVE_ADVANCED_FIELDS instead */
export const ACCUMULATIVE_FIELDS: FieldConfig[] = [
	...ACCUMULATIVE_PRIMARY_FIELDS,
	...ACCUMULATIVE_ADVANCED_FIELDS
]

/**
 * Default values from viewer package
 * Re-exported for convenience
 */
export { defaultShadowOptions }
