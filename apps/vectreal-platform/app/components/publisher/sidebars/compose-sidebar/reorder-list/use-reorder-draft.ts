import { useCallback, useEffect, useRef, useState } from 'react'

import type { ReorderMoveDelta } from './reorder-handle'

/** Where a moved row landed, 1-based, for the announcement. */
export interface ReorderOutcome {
	position: number
	total: number
}

interface ReorderDraftOptions {
	/** The order stored now, which the draft re-seeds from whenever no drag is in flight. */
	ids: string[]
	/**
	 * Writes an order and says where the moved row landed, or returns null when
	 * the order is not a move (released where it began, or stale).
	 */
	commit: (order: string[], movedId: string) => ReorderOutcome | null
	announce: (message: string) => void
	/** What to say once a move has landed. */
	describeMove?: (name: string, outcome: ReorderOutcome) => string
}

const defaultDescribeMove = (
	name: string,
	{ position, total }: ReorderOutcome
) => `${name} moved to position ${position} of ${total}.`

/**
 * The order a reorderable list shows while a drag is in flight, and the commit
 * that writes it.
 *
 * `Reorder.Group` fires `onReorder` on every adjacent swap, and what the lists
 * write is read by the editor scene, so committing each one would re-render
 * the 3D view for every pixel of the drag. The store is written once, on
 * release.
 */
export function useReorderDraft({
	ids,
	commit,
	announce,
	describeMove = defaultDescribeMove
}: ReorderDraftOptions) {
	const [draftOrder, setDraftOrder] = useState<string[]>(ids)
	const draftOrderRef = useRef(ids)
	/**
	 * State, not a ref, so the re-seed below can see a drag end.
	 *
	 * As a ref it was invisible to the effect's dependencies: a write to the
	 * store during a drag - the canvas gizmo under a second touch point, or a
	 * scene load - ran the effect once, hit the guard, and nothing afterwards
	 * could make it run again, so the draft stayed diverged from the store for
	 * the life of the panel. One render at drag start is the whole cost.
	 */
	const [isDragging, setIsDragging] = useState(false)

	/** Keeps the ref beside the state, so a commit outside React can read it. */
	const applyDraftOrder = useCallback((order: string[]) => {
		draftOrderRef.current = order
		setDraftOrder(order)
	}, [])

	useEffect(() => {
		if (isDragging) return
		draftOrderRef.current = ids
		setDraftOrder(ids)
	}, [isDragging, ids])

	/** Writes a new order, and says so once it is actually new. */
	const commitOrder = useCallback(
		(order: string[], movedId: string, movedName: string) => {
			const outcome = commit(order, movedId)
			if (outcome) announce(describeMove(movedName, outcome))
		},
		[announce, commit, describeMove]
	)

	const endDrag = useCallback(
		(id: string, name: string) => {
			setIsDragging(false)
			commitOrder(draftOrderRef.current, id, name)
		},
		[commitOrder]
	)

	const moveByKeyboard = useCallback(
		(id: string, name: string, delta: ReorderMoveDelta) => {
			const from = draftOrder.indexOf(id)
			if (from < 0) return

			const to =
				delta === 'first'
					? 0
					: delta === 'last'
						? draftOrder.length - 1
						: from + delta

			// Silence at the ends is indistinguishable from a key that does
			// nothing, so a refused move is announced rather than swallowed.
			if (to < 0 || to >= draftOrder.length || to === from) {
				// Named from the direction asked for, not from the index it started
				// at: in a one-row list `from` is always 0, so reading the index
				// announced "already first" for a press asking to go last.
				const towardsEnd = delta === 'last' || delta === 1
				announce(`${name} is already ${towardsEnd ? 'last' : 'first'}.`)
				return
			}

			const next = [...draftOrder]
			next.splice(to, 0, ...next.splice(from, 1))
			applyDraftOrder(next)
			commitOrder(next, id, name)
		},
		[announce, applyDraftOrder, commitOrder, draftOrder]
	)

	return {
		draftOrder,
		applyDraftOrder,
		startDrag: () => setIsDragging(true),
		endDrag,
		moveByKeyboard
	}
}
