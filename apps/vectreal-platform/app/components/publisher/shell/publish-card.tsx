import { Skeleton } from '@shared/components/ui/skeleton'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn, formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react'

import { PUBLISHER_EDGE_INSET, PUBLISHER_LAYER } from './shell-layout'
import {
	DELIVERY_REFERENCE_LABEL,
	estimateDeliveryTime
} from '../../../lib/domain/scene/scene-delivery-estimate'
import {
	hasUnsavedChangesAtom,
	isPreviewModeAtom,
	sceneMetaAtom
} from '../../../lib/stores/publisher-config-store'

import type { FC } from 'react'

interface PublishCardProps {
	sceneBytes?: null | number
	isSceneSizeLoading?: boolean
	/** Transient loader/optimizer status; replaces the metric line while set. */
	statusText?: null | string
	isPublished: boolean
	onOpenPublishPanel: () => void
	onOpenOptimization: () => void
	disabled: boolean
}

/**
 * The publisher's outbound affordance, floating at the bottom-right of the
 * canvas stage with the same inset as the tool rail.
 *
 * Carries three things at a glance: what the scene looks like, what state it is
 * in, and what it costs a viewer to load. That last line is why the scene-size
 * toolbar row could go away — a byte count needs a label to mean anything,
 * while an estimated load time explains itself and makes the case for
 * optimizing without a nag.
 */
export const PublishCard: FC<PublishCardProps> = ({
	sceneBytes,
	isSceneSizeLoading = false,
	statusText = null,
	isPublished,
	onOpenPublishPanel,
	onOpenOptimization,
	disabled
}) => {
	const { thumbnailUrl } = useAtomValue(sceneMetaAtom)
	const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom)
	const isPreviewMode = useAtomValue(isPreviewModeAtom)

	const estimate = estimateDeliveryTime(sceneBytes)
	const statusLabel = isPublished
		? hasUnsavedChanges
			? 'Unpublished changes'
			: 'Published'
		: 'Draft'

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			// Preview mode is about seeing the scene, so the card leaves rather than
			// dimming. `animate` (not `exit`) keeps it mounted, so its own publish
			// state survives the round trip.
			animate={isPreviewMode ? { opacity: 0, y: 12 } : { opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
			aria-hidden={isPreviewMode}
			className={cn(
				'publisher-shell-panel absolute right-0 bottom-0 w-60 overflow-hidden p-2',
				PUBLISHER_EDGE_INSET,
				PUBLISHER_LAYER.card,
				isPreviewMode && 'pointer-events-none',
				disabled && 'pointer-events-none opacity-45 saturate-50'
			)}
		>
			{/*
			  The card opens the publish panel, but the size line below opens
			  optimization, so the primary action is an overlay button rather than a
			  wrapper. Nesting one button inside another would be invalid markup and
			  would break keyboard access to both.
			*/}
			<button
				type="button"
				onClick={onOpenPublishPanel}
				disabled={disabled}
				aria-label="Open publishing panel"
				className="publisher-shell-focus absolute inset-0 z-0 rounded-xl"
			/>

			<div className="pointer-events-none relative z-10 space-y-2">
				<div className="bg-shell-surface-soft relative aspect-video w-full overflow-hidden rounded-lg">
					{thumbnailUrl ? (
						<img
							src={thumbnailUrl}
							alt=""
							className="h-full w-full object-cover"
							loading="lazy"
						/>
					) : (
						<div className="text-muted-foreground/40 flex h-full w-full items-center justify-center">
							<ImageIcon className="h-6 w-6" />
						</div>
					)}

					<span
						className={cn(
							'bg-shell-overlay absolute right-1.5 bottom-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-md',
							isPublished && !hasUnsavedChanges
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-muted-foreground'
						)}
					>
						<span
							className={cn(
								'h-1.5 w-1.5 rounded-full',
								isPublished && !hasUnsavedChanges
									? 'bg-emerald-500'
									: 'bg-muted-foreground/50'
							)}
							aria-hidden="true"
						/>
						{statusLabel}
					</span>
				</div>

				<div className="space-y-0.5 px-1 pb-0.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-sm font-medium">Publish</span>
						<ArrowUpRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
					</div>

					{statusText ? (
						<p className="text-muted-foreground truncate text-[11px]">
							{statusText}
						</p>
					) : isSceneSizeLoading ? (
						<Skeleton className="h-3 w-28 rounded-sm" />
					) : estimate && typeof sceneBytes === 'number' ? (
						/*
						  The metric line opens optimization rather than the publish
						  panel. The amber dot lives here, so acting on it should not
						  mean routing through a publish panel that is mostly locked
						  until the scene has been saved once.
						*/
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={onOpenOptimization}
									disabled={disabled}
									className="publisher-shell-focus text-muted-foreground hover:text-foreground hover:bg-shell-surface-soft pointer-events-auto -mx-1 flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] tabular-nums transition-colors"
								>
									{estimate.isSlow && (
										<span
											className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
											aria-hidden="true"
										/>
									)}
									{formatFileSize(sceneBytes)} · {estimate.label} on{' '}
									{DELIVERY_REFERENCE_LABEL}
								</button>
							</TooltipTrigger>
							<TooltipContent side="left">
								{estimate.isSlow ? 'Slow to load. Optimize' : 'Optimize'}
							</TooltipContent>
						</Tooltip>
					) : (
						<p className="text-muted-foreground text-[11px]">
							Size not measured yet
						</p>
					)}
				</div>
			</div>
		</motion.div>
	)
}
