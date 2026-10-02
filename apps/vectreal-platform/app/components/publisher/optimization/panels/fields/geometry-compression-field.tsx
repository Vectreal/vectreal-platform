import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'

import { StepBlock, StepToggle } from './optimization-step'
import { PanelCaption, SettingGroup } from '../../../sidebars/sidebar-section'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { FC } from 'react'

type DracoMethod = 'edgebreaker' | 'sequential'

const METHOD_OPTIONS: { value: DracoMethod; label: string }[] = [
	{ value: 'edgebreaker', label: 'Smallest' },
	{ value: 'sequential', label: 'Keep vertex order' }
]

/**
 * Draco compression. Leads the advanced panel because it is the largest saving
 * available and, unlike polygon reduction, it does not change the mesh.
 */
export const GeometryCompressionField: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const draco = optimizations.draco
	const isEnabled = Boolean(draco?.enabled)

	return (
		<StepBlock>
			<StepToggle
				step="draco"
				checked={isEnabled}
				onCheckedChange={(enabled) => update('draco', { enabled })}
			/>

			{isEnabled && (
				<>
					<SettingGroup label="Compression method">
						<ToggleGroup
							type="single"
							aria-label="Compression method"
							value={draco?.method ?? 'edgebreaker'}
							onValueChange={(method) => {
								if (method) update('draco', { method: method as DracoMethod })
							}}
						>
							{METHOD_OPTIONS.map((option) => (
								<ToggleGroupItem key={option.value} value={option.value}>
									{option.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</SettingGroup>

					<PanelCaption>
						Compression is applied when you publish, so the scene you edit stays
						at full precision. Vertex quantization is switched off because Draco
						does its own.
					</PanelCaption>
				</>
			)}
		</StepBlock>
	)
}
