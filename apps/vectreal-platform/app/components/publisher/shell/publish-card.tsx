import { Skeleton } from '@shared/components/ui/skeleton'
import { cn, formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react'

import {
	DELIVERY_REFERENCE_LABEL,
	estimateDeliveryTime
} from '../../../lib/domain/scene/scene-delivery-estimate'
import {
	hasUnsavedChangesAtom,
	isPreviewModeAtom,
	sceneMetaAtom
} from '../../../lib/stores/publisher-config-store'

import type { FC, ReactNode } from 'react'

/*
  One 8px step for the card's padding and every gap inside it, and inner
  corners at the card's radius (`rounded-xl`, which `publisher-shell-panel`
  sets) less that padding, so the thumbnail and both triggers sit concentric
  with the card.
*/
const INNER_RADIUS = 'rounded-[calc(var(--radius-xl)-0.5rem)]'

/** One of the card's two doors: what it opens, and the scene's state there. */
const CardTrigger = ({
	title,
	status,
	onClick,
	disabled
}: {
	title: string
	status: ReactNode
	onClick: () => void
	disabled: boolean
}) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className={cn(
			'publisher-shell-focus ds-field-interactive flex w-full items-center gap-2 px-3 py-2 text-left',
			INNER_RADIUS
		)}
	>
		<span className="min-w-0 flex-1">
			<span className="block text-sm font-medium">{title}</span>
			{status}
		</span>
		<ArrowUpRight
			aria-hidden
			className="text-muted-foreground size-3.5 shrink-0"
		/>
	</button>
)

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
 * The publisher's outbound affordance, at the foot of the canvas stage's
 * bottom-right column, under the save progress.
 *
 * Two triggers on one card, grouped because they are two halves of shipping:
 * **Publish** opens the publish panel and says what state the scene is in,
 * **Optimize** opens the optimization drawer and says what the scene costs a
 * viewer to load. They used to be one card-sized overlay button with a second
 * button nested on top of it and a status badge over the thumbnail, so the
 * card's target and its parts were hard to tell apart; now each is a button of
 * its own and the thumbnail is just the picture.
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
				'publisher-shell-panel pointer-events-auto flex w-full shrink-0 flex-col gap-2 overflow-hidden p-2',
				isPreviewMode && 'pointer-events-none',
				disabled && 'pointer-events-none opacity-45 saturate-50'
			)}
		>
			<div
				className={cn(
					'bg-shell-surface-soft relative aspect-video w-full overflow-hidden',
					INNER_RADIUS
				)}
			>
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
			</div>

			<CardTrigger
				title="Publish"
				onClick={onOpenPublishPanel}
				disabled={disabled}
				status={
					<span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
						{isPublished && !hasUnsavedChanges && (
							<span
								aria-hidden
								className="bg-foreground size-1.5 shrink-0 rounded-full"
							/>
						)}
						{statusLabel}
					</span>
				}
			/>

			<CardTrigger
				title="Optimize"
				onClick={onOpenOptimization}
				disabled={disabled}
				status={
					statusText ? (
						<span className="text-muted-foreground block truncate text-[11px]">
							{statusText}
						</span>
					) : isSceneSizeLoading ? (
						<Skeleton className="mt-1 h-3 w-28 rounded-sm" />
					) : estimate && typeof sceneBytes === 'number' ? (
						<span className="text-muted-foreground flex items-center gap-1.5 text-[11px] tabular-nums">
							{estimate.isSlow && (
								<span
									className="size-1.5 shrink-0 rounded-full bg-amber-500"
									aria-hidden
								/>
							)}
							<span className="truncate">
								{formatFileSize(sceneBytes)} · {estimate.label} on{' '}
								{DELIVERY_REFERENCE_LABEL}
							</span>
							{estimate.isSlow && (
								<span className="sr-only">, slow to load</span>
							)}
						</span>
					) : (
						<span className="text-muted-foreground block text-[11px]">
							Size not measured yet
						</span>
					)
				}
			/>
		</motion.div>
	)
}
