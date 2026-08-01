import { formatFileSize } from '@shared/utils'
import { Sparkles, TriangleAlert } from 'lucide-react'

import {
	DELIVERY_ESTIMATE_EXPLANATION,
	DELIVERY_REFERENCE_LABEL,
	estimateDeliveryTime
} from '../../../../../lib/domain/scene/scene-delivery-estimate'
import { InfoTooltip } from '../../../../info-tooltip'

import type { FC } from 'react'

interface DeliverySummaryProps {
	sceneBytes?: null | number
	sizeReductionPercent: null | number
	sizeDeltaLabel: null | string
	onOpenOptimization?: () => void
}

/**
 * What the scene costs a viewer, and the offer to reduce it.
 *
 * Sits at the top of the publish sidebar because it gates everything below:
 * optimization is only worth thinking about at the moment you decide to ship,
 * and that is exactly where the user is standing when they open this panel.
 *
 * The optimize call to action is loud only while there is headroom. Once a pass
 * has run it demotes itself to a confirmation with a quiet re-run link, so it
 * stops competing with the publish action it is supposed to lead into.
 *
 * Deliberately not gated on the scene being saved or the user being signed in.
 * Optimization is a local pass over the loaded model that needs neither, and
 * gating it made it unreachable exactly when it matters most: on a fresh upload
 * that is over the plan's size limit and therefore cannot be saved until it
 * shrinks.
 */
export const DeliverySummary: FC<DeliverySummaryProps> = ({
	sceneBytes,
	sizeReductionPercent,
	sizeDeltaLabel,
	onOpenOptimization
}) => {
	const estimate = estimateDeliveryTime(sceneBytes)
	const hasOptimized = sizeReductionPercent !== null

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-muted-foreground text-eyebrow">Delivery</p>
				{estimate ? (
					<span className="text-muted-foreground text-label-xs flex items-center gap-1">
						{estimate.label} on {DELIVERY_REFERENCE_LABEL}
						<InfoTooltip content={DELIVERY_ESTIMATE_EXPLANATION} />
					</span>
				) : null}
			</div>

			{/*
			  The saving reads as a continuation of the size rather than a badge
			  beside it, so the eye lands on what the scene weighs first and picks
			  up how far it came second.
			*/}
			<p className="flex items-baseline gap-1.5">
				<span className="text-2xl font-medium tracking-tight tabular-nums">
					{typeof sceneBytes === 'number' ? formatFileSize(sceneBytes) : '-'}
				</span>
				{hasOptimized && sizeDeltaLabel ? (
					<span className="text-muted-foreground text-xs tabular-nums">
						/ {sizeDeltaLabel}
					</span>
				) : null}
			</p>

			{/*
			  Only offered while there is still headroom. Once a pass has run the
			  Optimization section below owns the controls, so repeating a call to
			  action here would just compete with the publish action this section
			  is meant to lead into.
			*/}
			{onOpenOptimization && !hasOptimized ? (
				<button
					type="button"
					onClick={onOpenOptimization}
					className="publisher-shell-focus publisher-shell-nested-interactive w-full rounded-xl p-3 text-left"
				>
					{/*
					  A slow scene changes the urgency of this control, not its identity.
					  It used to swap the whole surface to an amber tint, which read as a
					  different kind of element and also cost it its hover state, since
					  the tint and the surface class set the same property.
					*/}
					<span className="flex items-center gap-2">
						{estimate?.isSlow ? (
							<TriangleAlert className="text-warning h-4 w-4 shrink-0" />
						) : (
							<Sparkles className="text-orange h-4 w-4 shrink-0" />
						)}
						<span className="text-sm font-medium">Optimize scene</span>
					</span>
					<span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
						{estimate?.isSlow
							? 'This scene is slow to load. Geometry and texture compression typically cuts 40 to 70%.'
							: 'Geometry and texture compression, typically cutting 40 to 70% before you publish.'}
					</span>
				</button>
			) : null}
		</div>
	)
}
