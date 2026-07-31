import { Label } from '@shared/components/ui/label'

import { SettingToggle, ToggleButtonGroup } from '../../../settings-components'
import { getOptimizationDefinition } from '../../model'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type { FC } from 'react'

type DracoMethod = 'edgebreaker' | 'sequential'

const METHOD_OPTIONS: ToggleButtonGroupOption<DracoMethod>[] = [
	{
		value: 'edgebreaker',
		label: 'Smallest',
		subLabel: 'Best compression'
	},
	{
		value: 'sequential',
		label: 'Sequential',
		subLabel: 'Keeps vertex order'
	}
]

/**
 * Draco compression. Leads the advanced panel because it is the largest saving
 * available and, unlike polygon reduction, it does not change the mesh.
 */
export const GeometryCompressionField: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const definition = getOptimizationDefinition('draco')
	const draco = optimizations.draco
	const isEnabled = Boolean(draco?.enabled)

	return (
		<div className="bg-shell-surface-soft/50 space-y-4 rounded-xl p-4 shadow-sm">
			<SettingToggle
				enabled={isEnabled}
				onToggle={(enabled) => update('draco', { enabled })}
				title={definition.title}
				description={definition.description}
				info={definition.tooltip}
			/>

			{isEnabled && (
				<>
					<div className="space-y-2">
						<Label className="text-sm font-semibold">Compression method</Label>
						<ToggleButtonGroup
							options={METHOD_OPTIONS}
							isActive={(value) =>
								(draco?.method ?? 'edgebreaker') === value
							}
							onChange={(method) => update('draco', { method })}
						/>
					</div>

					<p className="text-muted-foreground text-xs leading-relaxed">
						Compression is applied when you publish, so the scene you edit stays
						at full precision. Vertex quantization is switched off because Draco
						does its own.
					</p>
				</>
			)}
		</div>
	)
}
