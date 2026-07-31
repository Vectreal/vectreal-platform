import { SettingToggle } from '../../../settings-components'
import { getOptimizationDefinition } from '../../model'
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
		<div className="bg-shell-surface-soft/50 space-y-4 rounded-xl p-4 shadow-sm">
			{CLEANUP_KEYS.map((key) => {
				const definition = getOptimizationDefinition(key)
				const isSupersededByDraco = key === 'quantize' && isDracoEnabled

				return (
					<SettingToggle
						key={key}
						enabled={Boolean(optimizations[key]?.enabled)}
						onToggle={(enabled) => update(key, { enabled })}
						title={definition.title}
						description={
							isSupersededByDraco
								? 'Handled by geometry compression — not needed separately'
								: definition.description
						}
						info={definition.tooltip}
					/>
				)
			})}
		</div>
	)
}
