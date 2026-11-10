import { Button } from '@shared/components/ui/button'
import { resolveHotspotMarkers } from '@vctrl/viewer/hotspots'
import { Reorder, useReducedMotion } from 'framer-motion'
import { useAtom, useSetAtom } from 'jotai/react'
import { Locate, Plus } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { HotspotRow, SequencedRow } from './hotspot-row'
import {
	hotspotDisplayName,
	sequencedFirst,
	useHotspotEdits
} from './use-hotspot-edits'
import { applySequenceMove } from '../../../../../lib/domain/scene/scene-hotspot-sequence'
import {
	activeHotspotIdAtom,
	hotspotsAtom
} from '../../../../../lib/stores/scene-settings-store'
import { EmptyState } from '../../../../layout-components'
import { useSidebarCoversCanvas } from '../../dynamic-sidebar'
import { SidebarSection } from '../../sidebar-section'
import { useReorderDraft } from '../reorder-list'

import type { SequenceMove } from '../../../../../lib/domain/scene/scene-hotspot-sequence'
import type { HotspotDefinition } from '@vctrl/core'

/**
 * The sequence's draft order, committed to `hotspotsAtom` on release.
 * The drag and keyboard mechanics are `useReorderDraft`'s, shared with the
 * camera list; what is hotspot-specific is the commit.
 */
function useSequenceDraft(
	inSequence: HotspotDefinition[],
	announce: (message: string) => void
) {
	const setHotspots = useSetAtom(hotspotsAtom)
	const ids = useMemo(
		() => inSequence.map((hotspot) => hotspot.id),
		[inSequence]
	)

	/*
	  The annotated return type is load-bearing. TypeScript cannot see the
	  updater run, so a value captured from inside it narrows to `never`
	  after its own null guard and the announcement silently stops being
	  type-checked. Declaring the type at the boundary keeps it.

	  Capturing at all is safe because `hotspotsAtom` is a jotai primitive:
	  its write runs the updater once, synchronously, before the next
	  statement. A derived atom would break that, which is why the whole
	  decision lives in `applySequenceMove` rather than here. Do not copy
	  the shape to a React `useState` updater, which StrictMode invokes
	  twice in development - an impure one would then run twice too.

	  If the assumption ever does break, `applied` stays null and only the
	  announcement is skipped; the reorder still commits.

	  "Position" rather than "step" in what is announced: the step on a row is
	  what a visitor is shown, and `resolveHotspotMarkers` ranks that over the
	  markers a visitor can reach. This list is the authoring order and counts
	  hidden members too, so calling both of them "step" would announce a
	  number that appears nowhere on screen.
	*/
	const commit = useCallback(
		(order: string[], movedId: string): SequenceMove | null => {
			let applied: SequenceMove | null = null

			setHotspots((prev) => {
				applied = applySequenceMove(prev, order, movedId)
				return applied ? applied.hotspots : prev
			})

			return applied
		},
		[setHotspots]
	)

	return useReorderDraft({ ids, commit, announce })
}

/**
 * The drill-down's root: every marker, the sequence first and in order.
 *
 * Announcements go up to the panel, whose live regions sit outside the
 * drill-down, so one made here is not unmounted with this view.
 */
export function MarkerList({
	announce
}: {
	announce: (message: string) => void
}) {
	const [hotspots] = useAtom(hotspotsAtom)
	const setSelectedId = useSetAtom(activeHotspotIdAtom)
	const edits = useHotspotEdits()
	const reduceMotion = useReducedMotion() ?? false
	const coversCanvas = useSidebarCoversCanvas()

	const { inSequence, rest } = useMemo(
		() => sequencedFirst(hotspots),
		[hotspots]
	)
	const sequence = useSequenceDraft(inSequence, announce)

	/**
	 * The step a visitor is actually shown.
	 *
	 * `resolveHotspotMarkers` owns this rule in `@vctrl/viewer`, and it ranks
	 * among reachable markers rather than printing `sequenceIndex + 1`. Computing
	 * an ordinal here instead would put a number on the row that nobody browsing
	 * the published scene ever sees: a hidden marker holding a slot shifts every
	 * step after it.
	 */
	const stepById = useMemo(() => {
		const steps = new Map<string, number>()
		for (const marker of resolveHotspotMarkers(hotspots)) {
			if (marker.step !== null) steps.set(marker.id, marker.step)
		}
		return steps
	}, [hotspots])

	/*
	  Deleting is the loudest thing this panel does, and the row goes, focus
	  moves and every later step renumbers, so it says what happened.
	*/
	const handleDelete = (hotspot: HotspotDefinition) => {
		const name = hotspotDisplayName(hotspot)
		const sequenceLeft = edits.remove(hotspot.id)
		announce(
			sequenceLeft
				? `${name} deleted. ${sequenceLeft.remainingInSequence} ${sequenceLeft.remainingInSequence === 1 ? 'marker' : 'markers'} left in the sequence.`
				: `${name} deleted.`
		)
	}

	const rowProps = (hotspot: HotspotDefinition) => ({
		hotspot,
		step: stepById.get(hotspot.id) ?? null,
		onOpen: () => setSelectedId(hotspot.id),
		onDelete: () => handleDelete(hotspot)
	})

	if (hotspots.length === 0) {
		return (
			<EmptyState
				size="inline"
				surface="shell"
				icon={Locate}
				title="Call out a point on the model"
				description={
					coversCanvas
						? 'Add a marker, then set where it sits under Position.'
						: 'Add a marker, then click the model to place it.'
				}
				action={
					<Button
						variant="outline"
						size="sm"
						onClick={edits.add}
						className="gap-1.5"
					>
						<Plus aria-hidden className="size-3.5" />
						Add marker
					</Button>
				}
			/>
		)
	}

	return (
		<SidebarSection
			title="Markers"
			tooltip="Markers call out a point on the model. Drag one to set the order viewers step through; a marker without a number is not in that order."
			action={
				<Button
					variant="ghost"
					size="sm"
					onClick={edits.add}
					className="shell-focus -my-1 h-7 gap-1.5 px-2"
				>
					<Plus aria-hidden className="size-3.5" />
					Add
				</Button>
			}
		>
			<div className="space-y-1">
				<p className="text-muted-foreground text-label-xs px-1">
					In the sequence
				</p>
				{inSequence.length === 0 ? (
					<p className="text-muted-foreground text-label-xs px-1 pb-1">
						Turn on “In sequence” for a marker below to add it.
					</p>
				) : (
					<Reorder.Group
						axis="y"
						role="list"
						values={sequence.draftOrder}
						onReorder={sequence.applyDraftOrder}
						className="space-y-1"
					>
						{sequence.draftOrder.map((id) => {
							const hotspot = inSequence.find((entry) => entry.id === id)
							if (!hotspot) return null
							const name = hotspotDisplayName(hotspot)
							return (
								<SequencedRow
									key={id}
									reduceMotion={reduceMotion}
									onDragStart={sequence.startDrag}
									onDragEnd={() => sequence.endDrag(id, name)}
									onMove={(delta) => sequence.moveByKeyboard(id, name, delta)}
									{...rowProps(hotspot)}
								/>
							)
						})}
					</Reorder.Group>
				)}
			</div>

			{rest.length > 0 && (
				<div className="space-y-1">
					<p className="text-muted-foreground text-label-xs px-1">
						Not in the sequence
					</p>
					<ul role="list" className="space-y-1">
						{rest.map((hotspot) => (
							<li key={hotspot.id}>
								<HotspotRow {...rowProps(hotspot)} />
							</li>
						))}
					</ul>
				</div>
			)}
		</SidebarSection>
	)
}
