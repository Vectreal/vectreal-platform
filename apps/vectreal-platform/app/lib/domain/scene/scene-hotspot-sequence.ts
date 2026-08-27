/**
 * Where each hotspot sits in the order a scene plays them back.
 *
 * No camera is involved, so these take the hotspot list on its own rather than
 * the paired state `scene-hotspot-camera-links` works in.
 *
 * The list is the order. Both functions here emit a dense `0..n-1` range rather
 * than an arbitrary set of unique integers, which is all the server enforces.
 * Density is not decoration: `resolve-hotspot-markers.ts` in `@vctrl/viewer`
 * numbers steps by rank instead of by `sequenceIndex + 1` specifically because
 * the swap these replaced left scenes holding 0, 1 and 4, and printing those
 * would tell a visitor there are steps they cannot find. Emitting a dense range
 * removes that cause. The viewer keeps its rank as hardening for consumers that
 * never pass through the publisher at all.
 */

import type { HotspotDefinition } from '@vctrl/core'

/** Applies a new index to a hotspot, or returns it untouched when it already holds one. */
const withSequenceIndex = (
	hotspot: HotspotDefinition,
	sequenceIndex: number | undefined
): HotspotDefinition =>
	hotspot.sequenceIndex === sequenceIndex
		? hotspot
		: { ...hotspot, sequenceIndex }

/**
 * The ids that will actually take a place in the order, in the order they take.
 *
 * A drag list is not trustworthy input: it can name a hotspot that has since
 * been deleted, and it can repeat one. Neither may consume a slot, or the
 * sequence ends up with a step nothing occupies.
 *
 * Exported because `reorderSequence` and `applySequenceMove` both have to agree
 * on it: one assigns the indices, the other compares against the stored order
 * and counts the position it announces. When only the first used it, an order
 * carrying a single stale id announced "position 3 of 3" for a two-member
 * sequence and committed no change at all.
 */
export function resolveSequenceOrder(
	hotspots: readonly HotspotDefinition[],
	orderedIds: readonly string[]
): string[] {
	const seen = new Set<string>()
	const resolved: string[] = []

	for (const id of orderedIds) {
		if (seen.has(id)) continue
		if (!hotspots.some((hotspot) => hotspot.id === id)) continue
		seen.add(id)
		resolved.push(id)
	}

	return resolved
}

/**
 * Renumbers the playback order from the ids, in the order given.
 *
 * This is what dragging a row asks for: a splice, not the swap the retired
 * `assignSequenceIndex` performed. Expressing a splice as a run of swaps
 * renumbers hotspots the author never touched.
 *
 * `orderedIds` is the whole sequence, so a hotspot missing from it leaves the
 * sequence. Ids naming no hotspot, and ids repeated in the list, consume no
 * index; both are reachable from a stale drag list, and letting either take a
 * slot would leave a step nothing occupies.
 *
 * The returned array keeps the order it arrived in. `scene-hotspot-comparison`
 * matches by id and stores no list order, and the panel sorts for display, so
 * reordering here would make the return value a second, competing claim about
 * what the order is.
 */
export function reorderSequence(
	hotspots: readonly HotspotDefinition[],
	orderedIds: readonly string[]
): HotspotDefinition[] {
	const assigned = new Map(
		resolveSequenceOrder(hotspots, orderedIds).map((id, index) => [id, index])
	)

	return hotspots.map((hotspot) =>
		withSequenceIndex(hotspot, assigned.get(hotspot.id))
	)
}

/**
 * Adds a hotspot to the playback order, or takes it out and closes the gap.
 *
 * Joining appends rather than inserting: the author asked to include the
 * hotspot, not to decide where it belongs, and the list is right there to drag.
 * Asking for the state a hotspot is already in leaves its position alone — the
 * switch is idempotent, so re-affirming membership must not quietly move a step
 * to the end of the sequence.
 */
export function setSequenceMembership(
	hotspots: readonly HotspotDefinition[],
	id: string,
	inSequence: boolean
): HotspotDefinition[] {
	const target = hotspots.find((hotspot) => hotspot.id === id)
	if (!target) return [...hotspots]

	const ordered = hotspots
		.filter((hotspot) => hotspot.sequenceIndex !== undefined)
		.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number))
		.map((hotspot) => hotspot.id)

	if (!inSequence) {
		return reorderSequence(
			hotspots,
			ordered.filter((memberId) => memberId !== id)
		)
	}

	return reorderSequence(
		hotspots,
		ordered.includes(id) ? ordered : [...ordered, id]
	)
}

/**
 * One move through the playback order: the new list, and where the marker
 * landed, or `null` when the move is not one.
 *
 * The decision and the numbers travel together on purpose. They were three
 * separate calls in the panel - is this applicable, resolve it, renumber it -
 * wired inside a state updater that no test can reach, because the only caller
 * that can produce an inapplicable order is a pointer drag. Two of the three
 * could be broken with the whole suite still green. Here the same three steps
 * are one unit with one specced contract.
 *
 * Two orders are not moves, and both arrive by drag:
 *
 * - one that resolves to the sequence already stored. A drag released where it
 *   began is not an edit, and announcing it would tell a screen reader that
 *   something moved when nothing did.
 * - one naming no hotspot in the list. framer deliberately keeps a drag session
 *   alive across unmount and still fires `onDragEnd`, so if a different scene
 *   loaded meanwhile, applying it would clear the sequence of a scene the
 *   author never touched.
 * - one that survives without the marker it was moving, which happens when that
 *   marker is deleted from elsewhere mid-drag. The rest may well have moved, but
 *   there is nothing left to announce and the position would read as zero.
 */
export interface SequenceMove {
	hotspots: HotspotDefinition[]
	/** 1-based place the marker landed in, for an announcement. */
	position: number
	/** How many markers the order ended up holding. */
	total: number
}

export function applySequenceMove(
	hotspots: readonly HotspotDefinition[],
	orderedIds: readonly string[],
	movedId: string
): SequenceMove | null {
	const resolved = resolveSequenceOrder(hotspots, orderedIds)
	if (resolved.length === 0) return null

	const stored = hotspots
		.filter((hotspot) => hotspot.sequenceIndex !== undefined)
		.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number))
		.map((hotspot) => hotspot.id)

	// Element-wise rather than comparing joined strings. Ids are uuids, so a
	// separator cannot appear inside one and both spellings agree today - but
	// that is a rule the save parser enforces two layers away, and this module
	// should not need it to be correct.
	const unchanged =
		stored.length === resolved.length &&
		stored.every((id, index) => id === resolved[index])
	if (unchanged) return null
	if (!resolved.includes(movedId)) return null

	return {
		hotspots: reorderSequence(hotspots, resolved),
		position: resolved.indexOf(movedId) + 1,
		total: resolved.length
	}
}
