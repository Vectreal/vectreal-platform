import { Button } from '@shared/components/ui/button'
import { Label } from '@shared/components/ui/label'
import { motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai/react'

import { defaultNormalizationOptions } from '../../../constants/viewer-defaults'
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
			className="publisher-shell-nested flex items-center justify-between gap-3 px-4 py-3"
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
						onClick={() =>
							setNormalization((prev) => ({ ...prev, enabled: false }))
						}
					>
						Revert to original size
					</Button>
				</>
			) : (
				<>
					<div className="flex items-center gap-2">
						<Label className="text-sm font-medium">Extreme model size</Label>
						<InfoTooltip content="This model's dimensions are outside a workable range. Normalizing scales it uniformly so shadows, camera framing, and other features work correctly." />
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							setNormalization((prev) => ({ ...prev, enabled: true }))
						}
					>
						Normalize size
					</Button>
				</>
			)}
		</motion.div>
	)
}
