import { Switch } from '@shared/components/ui/switch'
import { cn } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom } from 'jotai/react'

import { optimizationAtom } from '../../../../lib/stores/scene-optimization-store'
import { InfoTooltip } from '../../../info-tooltip'
import { ToggleButtonGroup } from '../../settings-components'

import type { ToggleButtonGroupOption } from '../../settings-components'

const REDUCTION_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 0.25, label: 'Light', subLabel: 'Preserve detail' },
	{ value: 0.45, label: 'Balanced', subLabel: 'General purpose' },
	{ value: 0.65, label: 'Aggressive', subLabel: 'Max reduction' }
]

const DEVIATION_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 0.002, label: 'Strict', subLabel: 'Best shape accuracy' },
	{ value: 0.007, label: 'Balanced', subLabel: 'Recommended' },
	{ value: 0.014, label: 'Relaxed', subLabel: 'Smaller output' }
]

function getClosestValue(
	options: ToggleButtonGroupOption<number>[],
	current: number
): number {
	return options.reduce((closest, o) =>
		Math.abs(o.value - current) < Math.abs(closest.value - current)
			? o
			: closest
	).value
}

interface SimplificationSettings {
	enabled: boolean
	ratio: number
	error: number
}

const useSimplificationSettings = () => {
	const [state, setOptimization] = useAtom(optimizationAtom)
	const { simplification } = state.optimizations

	const updateSettings = (updates: Partial<SimplificationSettings>) => {
		setOptimization((prev) => ({
			...prev,
			optimizations: {
				...prev.optimizations,
				simplification: { ...simplification, ...updates }
			}
		}))
	}

	return { settings: simplification, updateSettings }
}

export function SimplificationSettings() {
	const { settings, updateSettings } = useSimplificationSettings()
	const {
		optimizer: { report }
	} = useModelContext(true)

	const totalVertices = report?.stats.vertices.after || 0
	const { enabled, ratio, error } = settings
	const estimatedVertices = Math.round(totalVertices * (1 - (ratio || 0)))

	return (
		<>
			<div className="mb-4 flex items-center justify-between px-2">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Mesh Simplification</p>
					<InfoTooltip content="Reduces polygon count while preserving the overall shape. Higher values maintain more detail but result in larger file sizes." />
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) => updateSettings({ enabled: checked })}
				/>
			</div>

			<div
				className={cn(
					'bg-shell-surface-soft space-y-5 rounded-xl p-4 text-sm shadow-sm',
					!enabled && 'pointer-events-none opacity-50'
				)}
			>
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<p className="text-sm font-semibold">Reduction target</p>
							<InfoTooltip content="Select how aggressively the mesh should be reduced. Higher reduction creates smaller files with less geometry detail." />
						</div>
						<span className="text-accent text-xs font-medium">
							{Math.round(getClosestValue(REDUCTION_PRESETS, ratio ?? 0) * 100)}
							%
						</span>
					</div>
					<ToggleButtonGroup
						options={REDUCTION_PRESETS}
						isActive={(v) =>
							getClosestValue(REDUCTION_PRESETS, ratio ?? 0) === v
						}
						onChange={(v) => updateSettings({ ratio: v })}
					/>
				</div>

				<div className="publisher-shell-nested p-3 text-sm">
					<span className="text-muted-foreground">Estimated vertices: </span>
					<span className="text-accent font-medium">
						{estimatedVertices.toLocaleString()}
					</span>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<p className="text-sm font-semibold">Deviation limit</p>
							<InfoTooltip content="Sets the maximum shape deviation allowed during simplification. Lower values preserve more detail." />
						</div>
						<span className="text-accent text-xs font-medium">
							{getClosestValue(DEVIATION_PRESETS, error ?? 0.001).toFixed(3)}
						</span>
					</div>
					<ToggleButtonGroup
						options={DEVIATION_PRESETS}
						isActive={(v) =>
							getClosestValue(DEVIATION_PRESETS, error ?? 0.001) === v
						}
						onChange={(v) => updateSettings({ error: v })}
					/>
				</div>
			</div>
		</>
	)
}
