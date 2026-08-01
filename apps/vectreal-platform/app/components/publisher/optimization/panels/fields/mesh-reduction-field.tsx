import { Label } from '@shared/components/ui/label'
import { Switch } from '@shared/components/ui/switch'
import { cn } from '@shared/utils'
import { TriangleAlert } from 'lucide-react'

import { InfoTooltip } from '../../../../info-tooltip'
import { ToggleButtonGroup } from '../../../settings-components'
import { getOptimizationDefinition } from '../../model'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type { FC } from 'react'

/**
 * Values are what glTF-Transform's `simplify({ratio})` means: the fraction of
 * vertices to **keep**. The labels say so directly.
 *
 * This used to be inverted — the control offered `0.25` under the label
 * "Light — preserve detail" while the pipeline read it as "keep a quarter of
 * the mesh", the most destructive setting on offer.
 */
const KEEP_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 0.75, label: 'Light', subLabel: 'Keep 75%' },
	{ value: 0.5, label: 'Moderate', subLabel: 'Keep 50%' },
	{ value: 0.25, label: 'Aggressive', subLabel: 'Keep 25%' }
]

const DEVIATION_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 0.002, label: 'Strict', subLabel: 'Best shape accuracy' },
	{ value: 0.007, label: 'Balanced', subLabel: 'Recommended' },
	{ value: 0.014, label: 'Relaxed', subLabel: 'Allows more reduction' }
]

function getClosestValue(
	options: ToggleButtonGroupOption<number>[],
	current: number
): number {
	return options.reduce((closest, option) =>
		Math.abs(option.value - current) < Math.abs(closest.value - current)
			? option
			: closest
	).value
}

/**
 * Polygon reduction. Last in the panel and off in every preset: it rewrites
 * topology, which is a different trade from every other step here.
 */
export const MeshReductionField: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const definition = getOptimizationDefinition('simplification')
	const { enabled, ratio = 0.5, error = 0.007 } = optimizations.simplification

	return (
		<div className="border-warning/40 bg-warning/5 space-y-4 rounded-xl border p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<TriangleAlert className="text-warning h-4 w-4 shrink-0" />
						<Label className="text-sm font-semibold">{definition.title}</Label>
						<InfoTooltip content={definition.tooltip} />
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Destructive. Changes topology and can leave holes or shading seams.
						Use it when the triangle count is the problem — geometry
						compression already shrinks the download without touching the mesh.
					</p>
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) =>
						update('simplification', { enabled: checked })
					}
					className="mt-1"
				/>
			</div>

			<div
				className={cn(
					'bg-shell-surface-soft/50 space-y-5 rounded-xl p-4 text-sm shadow-sm',
					!enabled && 'hidden'
				)}
			>
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<p className="text-sm font-semibold">Target</p>
							<InfoTooltip content="The share of the mesh to keep. Lower keeps fewer triangles and reduces detail further." />
						</div>
						<span className="text-orange text-xs font-medium">
							Keep {Math.round(getClosestValue(KEEP_PRESETS, ratio) * 100)}%
						</span>
					</div>
					<ToggleButtonGroup
						options={KEEP_PRESETS}
						isActive={(value) => getClosestValue(KEEP_PRESETS, ratio) === value}
						onChange={(value) => update('simplification', { ratio: value })}
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<p className="text-sm font-semibold">Deviation limit</p>
							<InfoTooltip content="The maximum shape deviation allowed. The simplifier stops as soon as further collapses would exceed this, even if the target has not been reached." />
						</div>
						<span className="text-orange text-xs font-medium">
							{getClosestValue(DEVIATION_PRESETS, error).toFixed(3)}
						</span>
					</div>
					<ToggleButtonGroup
						options={DEVIATION_PRESETS}
						isActive={(value) =>
							getClosestValue(DEVIATION_PRESETS, error) === value
						}
						onChange={(value) => update('simplification', { error: value })}
					/>
				</div>

				<p className="text-muted-foreground text-xs leading-relaxed">
					The target is a ceiling, not a promise. The deviation limit and split
					vertices both stop the simplifier early, so the reduction is often
					smaller than requested. The result panel reports what was actually
					removed.
				</p>
			</div>
		</div>
	)
}
