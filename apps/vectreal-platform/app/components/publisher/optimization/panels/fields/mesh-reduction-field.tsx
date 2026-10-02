import { TriangleAlert } from 'lucide-react'

import { StepBlock, StepToggle } from './optimization-step'
import {
	closestPreset,
	NearestPresetGroup
} from '../../../sidebars/nearest-preset-group'
import { PanelCaption, SettingGroup } from '../../../sidebars/sidebar-section'
import { useOptimizationSettings } from '../../use-optimization-settings'

import type { SliderPreset } from '@shared/components/ui/slider'
import type { FC } from 'react'

/**
 * Values are what glTF-Transform's `simplify({ratio})` means: the fraction of
 * vertices to **keep**. The labels say so directly.
 *
 * This used to be inverted — the control offered `0.25` under the label
 * "Light — preserve detail" while the pipeline read it as "keep a quarter of
 * the mesh", the most destructive setting on offer.
 */
const KEEP_PRESETS: SliderPreset[] = [
	{ value: 0.75, label: 'Light' },
	{ value: 0.5, label: 'Moderate' },
	{ value: 0.25, label: 'Aggressive' }
]

const DEVIATION_PRESETS: SliderPreset[] = [
	{ value: 0.002, label: 'Strict' },
	{ value: 0.007, label: 'Balanced' },
	{ value: 0.014, label: 'Relaxed' }
]

/**
 * Polygon reduction. Last in the panel and off in every preset: it rewrites
 * topology, which is a different trade from every other step here.
 */
export const MeshReductionField: FC = () => {
	const { optimizations, update } = useOptimizationSettings()
	const { enabled, ratio = 0.5, error = 0.007 } = optimizations.simplification

	return (
		<StepBlock>
			<StepToggle
				step="simplification"
				checked={enabled}
				onCheckedChange={(checked) =>
					update('simplification', { enabled: checked })
				}
				icon={
					<TriangleAlert aria-hidden className="text-warning size-4 shrink-0" />
				}
				description="Destructive. Changes topology and can leave holes or shading seams. Use it when the triangle count is the problem; geometry compression already shrinks the download without touching the mesh."
			/>

			{enabled && (
				<>
					<SettingGroup
						label="Target"
						description="The share of the mesh to keep. Lower keeps fewer triangles and less detail."
						value={`Keep ${Math.round(closestPreset(KEEP_PRESETS, ratio).value * 100)}%`}
					>
						<NearestPresetGroup
							label="Target"
							presets={KEEP_PRESETS}
							value={ratio}
							onChange={(value) => update('simplification', { ratio: value })}
						/>
					</SettingGroup>

					<SettingGroup
						label="Deviation limit"
						description="The largest shape change allowed. Simplification stops at it, even short of the target."
						value={closestPreset(DEVIATION_PRESETS, error).value.toFixed(3)}
					>
						<NearestPresetGroup
							label="Deviation limit"
							presets={DEVIATION_PRESETS}
							value={error}
							onChange={(value) => update('simplification', { error: value })}
						/>
					</SettingGroup>

					<PanelCaption>
						The target is a ceiling, not a promise. The deviation limit and
						split vertices both stop the simplifier early, so the reduction is
						often smaller than requested. The result panel reports what was
						actually removed.
					</PanelCaption>
				</>
			)}
		</StepBlock>
	)
}
