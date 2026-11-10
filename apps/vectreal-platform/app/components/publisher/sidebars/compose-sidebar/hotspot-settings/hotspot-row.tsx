import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ChevronRight, EyeOff, SquarePen, Trash2 } from 'lucide-react'
import { memo } from 'react'

import { hotspotDisplayName } from './use-hotspot-edits'
import { useDrillDownNavigation } from '../../drill-down'
import {
	ReorderHandle,
	ReorderHandleSpacer,
	ReorderItem,
	type ReorderMoveDelta
} from '../reorder-list'

import type { HotspotDefinition } from '@vctrl/core'
import type { DragControls } from 'framer-motion'

/**
 * The view a marker row opens, which is also the key its row is found by on
 * the way back. It is one id per marker so that selecting another marker from
 * the canvas is a path change, and Back returns to that marker's row.
 */
export const hotspotViewId = (id: string) => `hotspot:${id}`

/** Id of the hint every reorder handle points at; the panel renders it once. */
export const REORDER_HINT_ID = 'hotspot-reorder-hint'

interface HotspotRowProps {
	hotspot: HotspotDefinition
	/** The step a visitor is shown, or null when this marker is outside the sequence. */
	step: number | null
	/** Present only for a marker in the sequence, which is the only one that reorders. */
	dragControls?: DragControls
	onOpen: () => void
	onDelete: () => void
	onMove?: (delta: ReorderMoveDelta) => void
}

/**
 * One marker in the list. The row opens the marker's own view rather than
 * expanding in place: an expanded editor nested a surface inside the row and
 * spent the panel's width on it, and opening *is* selecting, so the canvas
 * still shows which marker is being edited.
 */
export const HotspotRow = memo(
	({
		hotspot,
		step,
		dragControls,
		onOpen,
		onDelete,
		onMove
	}: HotspotRowProps) => {
		const { push } = useDrillDownNavigation()
		const name = hotspotDisplayName(hotspot)
		const hiddenFromViewers = !hotspot.visible || hotspot.internalOnly
		const viewId = hotspotViewId(hotspot.id)

		return (
			<div className="shell-nested-interactive flex items-center gap-1 rounded-xl pr-1">
				{dragControls && onMove ? (
					<ReorderHandle
						name={name}
						hintId={REORDER_HINT_ID}
						dragControls={dragControls}
						onMove={onMove}
					/>
				) : (
					<ReorderHandleSpacer />
				)}

				{step === null ? (
					<span
						aria-hidden
						className="text-muted-foreground text-label-xs flex size-5 shrink-0 items-center justify-center"
					>
						&mdash;
					</span>
				) : (
					<Badge
						variant="secondary"
						aria-hidden
						className="text-label-xs flex size-5 shrink-0 justify-center px-0 tabular-nums"
					>
						{step}
					</Badge>
				)}

				<button
					type="button"
					data-drill-down-trigger={viewId}
					onClick={() => {
						onOpen()
						push(viewId)
					}}
					className="shell-focus flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-1 pl-1 text-left"
				>
					<span className="min-w-0 flex-1">
						<span
							className={cn(
								'block truncate text-sm leading-tight font-medium',
								hiddenFromViewers && 'opacity-60'
							)}
						>
							{name}
						</span>
						<span className="text-muted-foreground text-label-xs block font-mono tabular-nums">
							{hotspot.worldPosition.map((axis) => axis.toFixed(2)).join(', ')}
						</span>
						{/*
						  Membership and step are two different facts. A marker the
						  author hid is still in the sequence, but
						  `resolveHotspotMarkers` ranks steps over the markers a
						  visitor can reach, so it carries no step - which is why
						  the badge shows a dash. Announcing that as "not in the
						  sequence" contradicted both the group it sits in and its
						  own switch.
						*/}
						<span className="sr-only">
							{hotspot.sequenceIndex === undefined
								? ', not in the sequence'
								: step === null
									? ', in the sequence, no step in the published scene'
									: `, step ${step}`}
							{hotspot.internalOnly
								? ', editor only'
								: hotspot.visible
									? ''
									: ', hidden from viewers'}
						</span>
					</span>
					<ChevronRight
						aria-hidden
						className="text-muted-foreground size-3.5 shrink-0"
					/>
				</button>

				{/*
				  Bare glyphs, not tooltip triggers: both states are already in the
				  trigger's own `sr-only` text, so the icon is the visual cue and
				  nothing is missing.
				*/}
				{!hotspot.visible && (
					<EyeOff
						aria-hidden
						className="text-muted-foreground size-3.5 shrink-0"
					/>
				)}
				{hotspot.internalOnly && (
					<SquarePen
						aria-hidden
						className="text-muted-foreground size-3.5 shrink-0"
					/>
				)}

				<Button
					variant="ghost"
					size="icon"
					aria-label={`Delete ${name}`}
					onClick={onDelete}
					className="shell-focus text-muted-foreground hover:text-destructive size-7 shrink-0"
				>
					<Trash2 aria-hidden className="size-3.5" />
				</Button>
			</div>
		)
	}
)

HotspotRow.displayName = 'HotspotRow'

/** A marker in the sequence, wrapped so it can be dragged. */
export const SequencedRow = ({
	reduceMotion,
	onDragStart,
	onDragEnd,
	...rowProps
}: Omit<HotspotRowProps, 'dragControls'> & {
	reduceMotion: boolean
	onDragStart: () => void
	onDragEnd: () => void
}) => (
	<ReorderItem
		value={rowProps.hotspot.id}
		reduceMotion={reduceMotion}
		onDragStart={onDragStart}
		onDragEnd={onDragEnd}
	>
		{(dragControls) => <HotspotRow {...rowProps} dragControls={dragControls} />}
	</ReorderItem>
)
