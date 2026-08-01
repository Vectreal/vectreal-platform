import type { PresetId } from '../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

/**
 * Preset pipelines, ordered from most faithful to smallest.
 *
 * Two rules hold across all of them:
 *
 * - **Draco is always on.** It is the largest geometry saving available and,
 *   unlike simplification, it does not change topology. It is applied at
 *   publish time, so the document being edited stays at full precision.
 * - **Quantize is always off.** Draco quantizes vertex attributes itself;
 *   stacking the standalone pass on top costs an extra pass and compounds
 *   precision loss. It stays available in the advanced panel as the fallback
 *   for anyone who turns Draco off.
 *
 * Mesh simplification is off everywhere. It is genuinely destructive (it can
 * leave holes and shading seams) and is opt-in from the advanced panel only.
 */

const sharedGeometry = {
	quantize: { enabled: false },
	dedup: { enabled: true },
	normals: { enabled: false },
	simplification: { enabled: false, ratio: 0.5, error: 0.005 },
	draco: { enabled: true, method: 'edgebreaker' }
} as const satisfies Omit<Optimizations, 'texture'>

export const qualityPreset: Optimizations = {
	...sharedGeometry,
	texture: {
		enabled: true,
		resize: [2048, 2048],
		quality: 90,
		targetFormat: 'webp'
	}
}

export const balancedPreset: Optimizations = {
	...sharedGeometry,
	texture: {
		enabled: true,
		resize: [1024, 1024],
		quality: 80,
		targetFormat: 'webp'
	}
}

export const smallestPreset: Optimizations = {
	...sharedGeometry,
	texture: {
		enabled: true,
		resize: [512, 512],
		quality: 70,
		targetFormat: 'webp'
	}
}

export const optimizationPresets: Record<PresetId, Optimizations> = {
	quality: qualityPreset,
	balanced: balancedPreset,
	smallest: smallestPreset
}

/** The preset a scene starts on, and the fallback when nothing is persisted. */
export const DEFAULT_PRESET_ID: PresetId = 'balanced'
