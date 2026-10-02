import { StepBlock, StepToggle } from './optimization-step'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { FC } from 'react'

const CLEANUP_KEYS = ['dedup', 'normals', 'quantize'] as const

/**
 * The cheap, non-destructive passes. Grouped together because none of them
 * needs its own settings and none changes what the model looks like beyond
 * precision.
 */
export const CleanupFields: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const isDracoEnabled = Boolean(optimizations.draco?.enabled)

	return (
		<StepBlock>
			{CLEANUP_KEYS.map((key) => (
				<StepToggle
					key={key}
					step={key}
					checked={Boolean(optimizations[key]?.enabled)}
					onCheckedChange={(enabled) => update(key, { enabled })}
					description={
						key === 'quantize' && isDracoEnabled
							? 'Handled by geometry compression, not needed separately.'
							: undefined
					}
				/>
			))}
		</StepBlock>
	)
}
