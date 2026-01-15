import { useAtom } from 'jotai/react'
import { BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react'
import { useCallback, useEffect } from 'react'

import { optimizationPresets } from '../../../../constants/optimizations'
import { optimizationAtom } from '../../../../lib/stores/publisher-config-store'
import { RadioAccordion } from '../../../radio-accordion'
import { Option } from '../../../radio-accordion/types'

export type OptimizationPreset = 'low' | 'medium' | 'high'

export const presetOptions: Option<OptimizationPreset>[] = [
	{
		id: 'low',
		label: 'Low Optimization',
		description:
			'Preserves most details with greater file size. Best for high-fidelity previews and final renders.',
		icon: <BatteryLow className="h-4 w-4" />
	},
	{
		id: 'medium',
		label: 'Balanced',
		description:
			'Well balanced between quality and performance. Recommended for most use cases and development.',
		icon: <BatteryMedium className="h-4 w-4" />
	},
	{
		id: 'high',
		label: 'High Optimization',
		description:
			'Optimized for performance and small file sizes. Best for mobile devices and low-end hardware.',
		icon: <BatteryFull className="h-4 w-4" />
	}
]

const BasicPanel = () => {
	const [{ optimizationPreset }, setOptimizationConfig] =
		useAtom(optimizationAtom)

	const handleSelectOptimizationPreset = useCallback(
		(presetOption: Option<OptimizationPreset>) => {
			if (optimizationPreset === presetOption.id) {
				return
			}

			setOptimizationConfig((prev) => ({
				...prev,
				optimizationPreset: presetOption.id,
				optimizations: optimizationPresets[presetOption.id]
			}))
		},
		[optimizationPreset, setOptimizationConfig]
	)

	const selectedPresetOption = presetOptions.find(
		(option) => option.id === optimizationPreset
	)

	// initially set the optimization preset to the current one
	useEffect(() => {
		handleSelectOptimizationPreset(selectedPresetOption || presetOptions[0])
	}, [
		handleSelectOptimizationPreset,
		optimizationPreset,
		selectedPresetOption,
		setOptimizationConfig
	])

	if (!selectedPresetOption) {
		console.warn(
			`Optimization preset "${optimizationPreset}" not found in preset options.`
		)
	}

	return (
		<RadioAccordion
			options={presetOptions}
			selectedOption={selectedPresetOption}
			onSelectPreset={handleSelectOptimizationPreset}
			label="Either select a preset or go to the advanced optimization options."
			description="After configuring you need to apply the optimizations to see the
	changes.
"
		/>
	)
}

export default BasicPanel
