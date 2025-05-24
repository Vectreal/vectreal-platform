import { useAtom } from 'jotai/react'
import { useCallback, useEffect } from 'react'

import { optimizationPresets } from '../../../../../lib/constants/optimizations'
import { optimizationAtom } from '../../../../../lib/stores/publisher-config-store'

import { presetOptions } from './preset-data'
import PresetOption from './preset-option'
import { OptimizationPreset } from './types'

const BasicPanel = () => {
	const [{ optimizationPreset }, setOptimizationConfig] =
		useAtom(optimizationAtom)

	const handleSelectOptimizationPreset = useCallback(
		(preset: OptimizationPreset) => {
			if (optimizationPreset === preset) {
				return
			}

			setOptimizationConfig((prev) => ({
				...prev,
				optimizationPreset: preset,
				plannedOptimizations: optimizationPresets[preset]
			}))
		},
		[optimizationPreset, setOptimizationConfig]
	)

	// initially set the optimization preset to the current one
	useEffect(() => {
		handleSelectOptimizationPreset(optimizationPreset)
	}, [
		handleSelectOptimizationPreset,
		optimizationPreset,
		setOptimizationConfig
	])

	return (
		<div className="w-full">
			<div className="space-y-2">
				<p className="px-2">
					Either select a preset or go to the advanced optimization options.
				</p>
				<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
					After configuring you need to apply the optimizations to see the
					changes.
				</small>
				{presetOptions.map((preset) => (
					<PresetOption
						key={preset.id}
						preset={preset}
						isSelected={optimizationPreset === preset.id}
						onSelect={() => handleSelectOptimizationPreset(preset.id)}
					/>
				))}
			</div>
		</div>
	)
}

export default BasicPanel
