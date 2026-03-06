
import { optimizationPresets } from '../../../../constants/optimizations'

import type { OptimizationPreset } from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

export const inferOptimizationPreset = (
	optimizations: Optimizations
): OptimizationPreset => {
	const entries = Object.entries(optimizationPresets) as Array<
		[keyof Optimizations, Optimizations]
	>

	const exactMatch = entries.find(([, presetValue]) => {
		return JSON.stringify(presetValue) === JSON.stringify(optimizations)
	})

	return (exactMatch?.[0] ?? 'medium') as OptimizationPreset
}
