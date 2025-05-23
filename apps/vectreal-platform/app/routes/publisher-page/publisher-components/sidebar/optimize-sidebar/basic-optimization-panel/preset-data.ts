import { OptimizationPresetOption } from './types'

export const presetOptions: OptimizationPresetOption[] = [
	{
		id: 'low',
		label: 'Low Optimization',
		description:
			'Preserves most details with greater file size. Best for high-fidelity previews and final renders.',
		icon: 'battery-low'
	},
	{
		id: 'medium',
		label: 'Balanced',
		description:
			'Well balanced between quality and performance. Recommended for most use cases and development.',
		icon: 'battery-medium'
	},
	{
		id: 'high',
		label: 'High Optimization',
		description:
			'Optimized for performance and small file sizes. Best for mobile devices and low-end hardware.',
		icon: 'battery-full'
	}
]
