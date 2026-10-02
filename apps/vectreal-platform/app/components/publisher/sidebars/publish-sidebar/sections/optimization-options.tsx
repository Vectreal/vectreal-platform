import { useAtomValue } from 'jotai/react'
import { ArrowUpRight, Sparkles } from 'lucide-react'

import { inferOptimizationPreset } from '../../../../../lib/domain/scene'
import { documentOptimizationsAtom } from '../../../../../lib/stores/scene-optimization-store'
import { listEnabledKeys } from '../../../optimization/model'
import { PRESET_META } from '../../../optimization/panels/preset-panel'
import { PanelRowButton } from '../../panel-row-button'
import { usePublishSidebarContext } from '../publish-sidebar-context'

import type { FC } from 'react'

/**
 * What the published scene was optimized with, in one line that opens the
 * optimization drawer. Read from the document, not the drawer's settings,
 * which can hold edits that were never applied.
 *
 * Complementary to the Delivery summary above it, which reports the outcome
 * (size and load time); this reports the inputs. It used to be a full section
 * listing every enabled step, which restated the drawer one click away, so it
 * now names the preset and how many steps it runs and leaves the detail to
 * the drawer.
 */
export const OptimizationOptions: FC = () => {
	const { onOpenOptimizationDrawer } = usePublishSidebarContext()
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const optimizationPreset = inferOptimizationPreset(optimizations)
	const stepCount = listEnabledKeys(optimizations).length
	const summary =
		stepCount === 0
			? 'Off'
			: `${optimizationPreset === 'custom' ? 'Custom' : PRESET_META[optimizationPreset].label} · ${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`

	return (
		<PanelRowButton
			onClick={() => onOpenOptimizationDrawer?.()}
			icon={<Sparkles aria-hidden />}
			label="Optimization"
			summary={summary}
			trailingIcon={<ArrowUpRight aria-hidden />}
		/>
	)
}
