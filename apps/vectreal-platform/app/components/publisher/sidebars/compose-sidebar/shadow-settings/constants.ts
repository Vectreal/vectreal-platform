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

export { defaultShadowOptions }
