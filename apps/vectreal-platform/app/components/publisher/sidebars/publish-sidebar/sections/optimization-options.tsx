import { Button } from '@shared/components/ui/button'
import { Check, Sparkles } from 'lucide-react'

import {
	getOptimizationDefinition,
	listEnabledKeys
} from '../../../optimization/model'
import { useOptimizationSettings } from '../../../optimization/use-optimization-settings'
import { usePublishSidebarContext } from '../publish-sidebar-context'

import type { OptimizationKey } from '../../../optimization/model'
import type { Optimizations } from '@vctrl/core'
import type { FC } from 'react'

const PRESET_LABELS: Record<string, string> = {
	quality: 'Maximum quality',
	balanced: 'Balanced',
	smallest: 'Smallest',
	custom: 'Custom'
}

/**
 * The settings worth restating next to a technique's name. Everything else is
 * either on or off, which the row itself already says.
 */
function describeSetting(
	key: OptimizationKey,
	optimizations: Optimizations
): null | string {
	if (key === 'texture') {
		const [width] = optimizations.texture.resize ?? []
		const quality = optimizations.texture.quality
		if (!width) return null
		return `${width}px · ${quality ?? 0}% quality`
	}

	if (key === 'simplification') {
		const ratio = optimizations.simplification.ratio
		return typeof ratio === 'number' ? `keep ${Math.round(ratio * 100)}%` : null
	}

	return null
}

/**
 * What the optimization pass is currently configured to do.
 *
 * Deliberately complementary to the Delivery section above, which reports the
 * outcome (size and load time). This reports the inputs, which nothing else in
 * the sidebar surfaces, and gives optimization a first-class place in the
 * sidebar's own navigation rather than only a call to action that quiets down
 * once a pass has run.
 */
export const OptimizationOptions: FC = () => {
	const { onOpenOptimizationDrawer } = usePublishSidebarContext()
	const { optimizations, optimizationPreset } = useOptimizationSettings()
	const enabledKeys = listEnabledKeys(optimizations)

	return (
		<div className="space-y-3 pb-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
					Preset
				</p>
				<span className="bg-shell-surface text-foreground rounded-lg px-2 py-0.5 text-xs font-medium">
					{PRESET_LABELS[optimizationPreset] ?? optimizationPreset}
				</span>
			</div>

			{enabledKeys.length > 0 ? (
				<div className="flex flex-col gap-1.5">
					{enabledKeys.map((key) => {
						const detail = describeSetting(key, optimizations)
						return (
							<div key={key} className="flex items-center gap-2 text-xs">
								<Check className="text-orange h-3 w-3 shrink-0" />
								<span className="text-foreground/75">
									{getOptimizationDefinition(key).title}
								</span>
								{detail ? (
									<span className="text-muted-foreground ml-auto tabular-nums">
										{detail}
									</span>
								) : null}
							</div>
						)
					})}
				</div>
			) : (
				<p className="text-muted-foreground text-xs">
					Nothing is enabled. The scene will be published as uploaded.
				</p>
			)}

			<Button
				type="button"
				size="sm"
				variant="secondary"
				className="w-full"
				onClick={() => onOpenOptimizationDrawer?.()}
			>
				<Sparkles className="h-3.5 w-3.5" />
				Open optimization settings
			</Button>
		</div>
	)
}
