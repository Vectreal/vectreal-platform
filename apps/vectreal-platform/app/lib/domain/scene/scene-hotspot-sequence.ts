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
	const assigned = new Map<string, number>()

	for (const id of orderedIds) {
		if (assigned.has(id)) continue
		if (!hotspots.some((hotspot) => hotspot.id === id)) continue
		assigned.set(id, assigned.size)
	}

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
