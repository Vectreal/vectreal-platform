import { defaultShadowOptions } from '../../../../../constants/viewer-defaults'

import type { FieldConfig } from '../../../../../types/settings-field'

export type { FieldConfig }

// ─── Accumulative shadow fields ──────────────────────────────────────────────

// "Darkness" drives the bake light's ambient fill (drei RandomizedLight.ambient),
// inverted: more darkness = less hemisphere fill under the model = deeper, blacker
// shadow core. Ambient is clamped to this range — never 0 (keeps a little softness)
// and never so high the shadow washes out. The virtual "darkness" slider value
// (0..1) is mapped to/from ambient in the panel.
export const SHADOW_AMBIENT_DARKEST = 0.05
export const SHADOW_AMBIENT_LIGHTEST = 0.6

/** Convert the 0..1 Darkness slider value to a RandomizedLight ambient value. */
export const darknessToAmbient = (darkness: number) =>
	SHADOW_AMBIENT_LIGHTEST -
	(SHADOW_AMBIENT_LIGHTEST - SHADOW_AMBIENT_DARKEST) * darkness

/** Inverse of {@link darknessToAmbient}. */
export const ambientToDarkness = (ambient: number) =>
	(SHADOW_AMBIENT_LIGHTEST - ambient) /
	(SHADOW_AMBIENT_LIGHTEST - SHADOW_AMBIENT_DARKEST)

/** Virtual field key handled specially in the panel (maps to light.ambient). */
export const SHADOW_DARKNESS_KEY = 'darkness'

/** Primary shadow controls shown by default */
export const SHADOW_PRIMARY_FIELDS: FieldConfig[] = [
	{
		key: 'opacity',
		label: 'Opacity',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Overall shadow strength.',
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: SHADOW_DARKNESS_KEY,
		label: 'Darkness',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip:
			'How deep the shadow core gets. Higher reduces ambient fill under the model for a darker, more solid shadow.',
		formatValue: (value) => `${Math.round(value * 100)}%`
	},
	{
		// drei RandomizedLight radius, in model-size units — larger radius spreads
		// the light samples wider, producing a softer penumbra.
		key: 'light.radius',
		label: 'Softness',
		min: 0,
		max: 3,
		step: 0.05,
		tooltip: 'Shadow softness. Higher values create softer, more diffuse edges.',
		formatValue: (value) => value.toFixed(2)
	}
]

// ─── Shadow presets ──────────────────────────────────────────────────────────

export interface ShadowPreset {
	id: string
	label: string
	description: string
	values: {
		opacity: number
		light: { ambient: number; radius: number; position: [number, number, number] }
	}
}

/**
 * One-tap looks. Each sets opacity, ambient fill (darkness), softness
 * (light.radius) and light direction (light.position, in model-size units)
 * together. Users can still fine-tune afterwards or drag the in-scene light
 * handle.
 */
export const SHADOW_PRESETS: ShadowPreset[] = [
	{
		id: 'soft',
		label: 'Soft',
		description: 'Diffuse, gentle grounding shadow.',
		values: {
			opacity: 0.7,
			light: { ambient: 0.5, radius: 1.4, position: [1.5, 4, 1.5] }
		}
	},
	{
		id: 'studio',
		label: 'Studio',
		description: 'Balanced product-shot shadow.',
		values: {
			opacity: 0.9,
			light: { ambient: 0.3, radius: 0.8, position: [2, 3, 2] }
		}
	},
	{
		id: 'dramatic',
		label: 'Dramatic',
		description: 'Deep, crisp, low-angle shadow.',
		values: {
			opacity: 1,
			light: { ambient: 0.08, radius: 0.4, position: [3, 2, 1] }
		}
	}
]

/**
 * Advanced shadow controls - hidden in collapsed section.
 * Scale is a multiple of the model's largest dimension, so the shadow plane
 * stays proportioned to the subject regardless of model size.
 */
export const SHADOW_ADVANCED_FIELDS: FieldConfig[] = [
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 1,
		max: 12,
		step: 0.1,
		tooltip:
			'Size of the shadow projection plane, as a multiple of the model size. Keep large enough to avoid clipping the shadow.',
		formatValue: (value) => value.toFixed(1)
	},
	{
		// Trim on the auto-calibrated cutoff (viewer measures the lit-plane
		// brightness per environment). 1 = pure auto; below deepens (risks ground
		// haze), above lightens.
		key: 'cutoffScale',
		label: 'Cutoff Trim',
		min: 0.85,
		max: 1.1,
		step: 0.01,
		tooltip:
			'Advanced: nudge the auto cutoff. The shadow threshold is calibrated to the environment automatically; lower this to deepen, raise to lighten if the ground hazes.',
		formatValue: (value) => `${Math.round(value * 100)}%`
	}
]

/**
 * Strength control for ambient occlusion (top-level `aoIntensity`). Shown only
 * while AO is enabled.
 */
export const SHADOW_AO_INTENSITY_FIELD: FieldConfig = {
	key: 'aoIntensity',
	label: 'AO Strength',
	min: 0.5,
	max: 4,
	step: 0.1,
	tooltip:
		'How dark the ambient occlusion darkens crevices and contact gaps on the model.',
	formatValue: (value) => value.toFixed(1)
}

/**
 * Controls for the soft contact/ground shadow (nested `contact.*`). Shown as
 * their own section, only while the ground shadow is enabled. Plane size and
 * capture height are derived from the model automatically.
 */
export const SHADOW_CONTACT_FIELDS: FieldConfig[] = [
	{
		key: 'contact.opacity',
		label: 'Opacity',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'How dark the ground shadow is.',
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'contact.blur',
		label: 'Softness',
		min: 0.5,
		max: 8,
		step: 0.1,
		tooltip:
			'Blur of the ground shadow. Higher is softer and hides the model surface detail.',
		formatValue: (value) => value.toFixed(1)
	},
	{
		key: 'contact.scale',
		label: 'Spread',
		min: 1,
		max: 4,
		step: 0.1,
		tooltip: 'How far the ground shadow spreads out from under the model.',
		formatValue: (value) => value.toFixed(1)
	},
	{
		key: 'contact.reach',
		label: 'Reach',
		min: 0.05,
		max: 1.5,
		step: 0.05,
		tooltip:
			'How far up from the floor the shadow reaches. Lower confines it to where the model is closest to the ground (tighter, more accurate ambient occlusion — e.g. only under the wheels); higher reaches up the model for a broad grounding pool.',
		formatValue: (value) => `${Math.round(value * 100)}%`
	}
]

export { defaultShadowOptions }
