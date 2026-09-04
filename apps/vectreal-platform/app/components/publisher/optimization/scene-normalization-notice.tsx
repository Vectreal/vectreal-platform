import { Button } from '@shared/components/ui/button'
import { Label } from '@shared/components/ui/label'
import { resolveNormalizedScale } from '@vctrl/core'
import { motion } from 'framer-motion'
import { useAtom, useAtomValue, useStore } from 'jotai/react'
import { useCallback } from 'react'

import { defaultNormalizationOptions } from '../../../constants/viewer-defaults'
import { applyHotspotReanchor } from '../../../lib/domain/scene/client/apply-hotspot-reanchor'
import {
	normalizationAtom,
	rawModelDiagonalAtom
} from '../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../info-tooltip'

import type { FC } from 'react'

/**
 * Offers uniform rescaling for models whose dimensions are far outside a
 * workable range.
 *
 * Not an optimization — it changes nothing about file size — but it shares the
 * drawer because an extreme scale is usually noticed at the same moment, and
 * it breaks shadows and camera framing if left alone. Renders nothing when the
 * model's scale is unremarkable.
 */
export const SceneNormalizationNotice: FC = () => {
	const [normalization, setNormalization] = useAtom(normalizationAtom)
	const rawDiagonal = useAtomValue(rawModelDiagonalAtom)
	const store = useStore()

	// Rescaling the model moves it out from under every hotspot, which stores a
	// world-space point captured under the previous scale. Both scales are known
	// right here, so the markers move with the geometry instead of detaching.
	const setNormalizationEnabled = useCallback(
		(enabled: boolean) => {
			// Read through the store rather than the render-time closure: the
			// manifest effect can write `normalizationAtom` between this render and
			// the click, and a snapshot would put the stale bounds back.
			const current = store.get(normalizationAtom)
			const next = { ...current, enabled }
			applyHotspotReanchor(
				store,
				resolveNormalizedScale(rawDiagonal, current),
				resolveNormalizedScale(rawDiagonal, next)
			)
			setNormalization(next)
		},
		[rawDiagonal, setNormalization, store]
	)

	const minSize = normalization.minSize ?? defaultNormalizationOptions.minSize
	const maxSize = normalization.maxSize ?? defaultNormalizationOptions.maxSize
	const isExtremeSize =
		rawDiagonal > 0 && (rawDiagonal < minSize || rawDiagonal > maxSize)

	if (!isExtremeSize) return null

	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2, delay: 0.01 }}
			className="publisher-shell-nested flex items-center justify-between gap-3 rounded-xl px-4 py-3"
		>
			{normalization.enabled ? (
				<>
					<div className="flex items-center gap-2">
						<Label className="text-sm font-medium">Size normalized</Label>
						<InfoTooltip content="This model has extreme dimensions. Normalization has been applied to keep it workable. Reverting restores the original scale." />
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setNormalizationEnabled(false)}
					>
						Revert to original size
					</Button>
				</>
			) : (
				<>
					<div className="flex items-center gap-2">
						<Label className="text-sm font-medium">Extreme model size</Label>
						<InfoTooltip content="This model's dimensions are outside a workable range. Normalizing scales it uniformly so shadows and camera framing work correctly." />
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setNormalizationEnabled(true)}
					>
						Normalize size
					</Button>
				</>
			)}
		</motion.div>
	)
}
