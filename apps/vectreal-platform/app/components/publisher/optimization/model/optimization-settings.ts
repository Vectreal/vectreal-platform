import type { OptimizationKey } from './optimization-catalog'
import type { Optimizations } from '@vctrl/core'

/**
 * Applies a change to one optimization, keeping mutually exclusive steps
 * consistent.
 *
 * Draco quantizes vertex attributes itself, so running the standalone quantize
 * pass alongside it costs an extra pass and compounds precision loss. The two
 * are alternatives, and toggling either one moves the other so the pair is
 * never both-on or both-off by accident.
 *
 * Written as a pure function so the coupling lives in one testable place rather
 * than in whichever control the user happened to touch.
 */
export function applyOptimizationChange<Key extends OptimizationKey>(
	optimizations: Optimizations,
	key: Key,
	updates: Partial<Optimizations[Key]>
): Optimizations {
	const next: Optimizations = {
		...optimizations,
		[key]: { ...optimizations[key], ...updates }
	}

	if (key === 'draco' && 'enabled' in updates) {
		next.quantize = {
			...next.quantize,
			enabled: !(updates as { enabled?: boolean }).enabled
		}
	}

	return next
}
