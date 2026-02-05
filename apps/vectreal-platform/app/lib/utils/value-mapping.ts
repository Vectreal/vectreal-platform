/**
 * Value mapping utilities for slider inputs
 * Provides logarithmic and exponential scaling for better control over wide ranges
 */

export type ValueMappingType = 'linear' | 'log' | 'exp'

export interface ValueMapping {
	type: ValueMappingType
	/** For exp mapping, the exponent to use (default: 2) */
	exponent?: number
	/** For log mapping, the base to use (default: 10) */
	base?: number
}

/**
 * Maps a slider value (0-1) to the actual value using the specified mapping
 */
export function mapSliderToValue(
	sliderValue: number,
	min: number,
	max: number,
	mapping: ValueMapping = { type: 'linear' }
): number {
	// Clamp slider value to [0, 1]
	const t = Math.max(0, Math.min(1, sliderValue))

	switch (mapping.type) {
		case 'log': {
			// Logarithmic mapping: more precision at lower values
			// y = min * (max/min)^t
			if (min <= 0) {
				console.warn(
					'Logarithmic mapping requires min > 0, falling back to linear'
				)
				return min + t * (max - min)
			}
			return min * Math.pow(max / min, t)
		}

		case 'exp': {
			const exponent = mapping.exponent ?? 2
			// Exponential mapping: more precision at higher values
			// y = min + (max - min) * t^exponent
			return min + (max - min) * Math.pow(t, exponent)
		}

		case 'linear':
		default:
			return min + t * (max - min)
	}
}

/**
 * Maps an actual value to a slider value (0-1) using the specified mapping
 */
export function mapValueToSlider(
	value: number,
	min: number,
	max: number,
	mapping: ValueMapping = { type: 'linear' }
): number {
	// Clamp value to [min, max]
	const clampedValue = Math.max(min, Math.min(max, value))

	switch (mapping.type) {
		case 'log': {
			if (min <= 0) {
				console.warn(
					'Logarithmic mapping requires min > 0, falling back to linear'
				)
				return (clampedValue - min) / (max - min)
			}
			// Inverse of log mapping: t = log(y/min) / log(max/min)
			return Math.log(clampedValue / min) / Math.log(max / min)
		}

		case 'exp': {
			const exponent = mapping.exponent ?? 2
			// Inverse of exp mapping: t = ((y - min) / (max - min))^(1/exponent)
			return Math.pow((clampedValue - min) / (max - min), 1 / exponent)
		}

		case 'linear':
		default:
			return (clampedValue - min) / (max - min)
	}
}

/**
 * Helper to create common mapping configurations
 */
export const valueMappings = {
	linear: { type: 'linear' as const },
	/** Logarithmic mapping - good for ranges like 0.01 to 1000 */
	log: { type: 'log' as const },
	/** Quadratic mapping - more precision at lower values */
	quadratic: { type: 'exp' as const, exponent: 2 },
	/** Cubic mapping - even more precision at lower values */
	cubic: { type: 'exp' as const, exponent: 3 },
	/** Square root mapping - more precision at higher values */
	sqrt: { type: 'exp' as const, exponent: 0.5 }
}
