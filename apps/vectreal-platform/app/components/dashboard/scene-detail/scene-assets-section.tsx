import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DetailPanelSection } from '../../layout-components'
import {
	buildAssetListItemProps,
	SceneAssetListItem
} from '../scene-asset-list-item'

import type { SerializedSceneAssetDataMap } from '../../../types/api'
import type { SceneAssetSummary } from '../../../types/dashboard'

/** Rows shown before the list asks to be expanded. */
const COLLAPSED_LIMIT = 6

interface SceneAssetsSectionProps {
	assets: SceneAssetSummary[]
	assetData?: SerializedSceneAssetDataMap | null
	className?: string
}

/**
 * Every asset linked to this scene.
 *
 * The one list. The aside used to render the first four with an "…and N more"
 * row that opened a drawer holding the same list again, expandable to the full
 * set - two renderings of one thing, and the shorter one existed only to point
 * at the longer.
 */
export function SceneAssetsSection({
	assets,
	assetData,
	className
}: SceneAssetsSectionProps) {
	const [expanded, setExpanded] = useState(false)
	const reduceMotion = useReducedMotion()

	const hasMore = assets.length > COLLAPSED_LIMIT
	const initial = assets.slice(0, COLLAPSED_LIMIT)
	const extra = assets.slice(COLLAPSED_LIMIT)

	const assetPropsById = useMemo(
		() =>
			new Map(
				assets.map((asset) => [
					asset.id,
					buildAssetListItemProps(asset, assetData)
				])
			),
		[assets, assetData]
	)

	return (
		<DetailPanelSection title="Assets" headingLevel="h2" className={className}>
			{assets.length === 0 ? (
				<p className="text-muted-foreground ds-sunken rounded-xl p-3 text-sm">
					No linked assets.
				</p>
			) : (
				<div className="space-y-2">
					{initial.map((asset) => (
						<SceneAssetListItem
							key={asset.id}
							className="ds-raised"
							{...(assetPropsById.get(asset.id) ||
								buildAssetListItemProps(asset, assetData))}
						/>
					))}

					<AnimatePresence initial={false}>
						{expanded && (
							<motion.div
								key="extra-assets"
								initial={reduceMotion ? false : { opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
								transition={{
									duration: reduceMotion ? 0 : 0.3,
									ease: 'easeInOut'
								}}
								className="space-y-2 overflow-hidden"
							>
								{extra.map((asset) => (
									<SceneAssetListItem
										key={asset.id}
										className="ds-raised"
										{...(assetPropsById.get(asset.id) ||
											buildAssetListItemProps(asset, assetData))}
									/>
								))}
							</motion.div>
						)}
					</AnimatePresence>

					{hasMore && (
						<button
							type="button"
							onClick={() => setExpanded((previous) => !previous)}
							aria-expanded={expanded}
							className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs transition-colors duration-200"
						>
							<motion.span
								animate={{ rotate: expanded ? 180 : 0 }}
								transition={{ duration: reduceMotion ? 0 : 0.25 }}
								className="inline-flex"
							>
								<ChevronDown className="h-3.5 w-3.5" />
							</motion.span>
							{expanded ? 'Show fewer' : `Show ${extra.length} more`}
						</button>
					)}
				</div>
			)}
		</DetailPanelSection>
	)
}
