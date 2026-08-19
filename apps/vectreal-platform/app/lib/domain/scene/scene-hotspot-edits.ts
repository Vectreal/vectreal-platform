/**
 * The hotspot edits whose consequences reach past the hotspot being edited.
 *
 * Deleting one retires its paired camera, which can leave a second hotspot
 * pointing at a camera that no longer exists and can leave the scene opening
 * on it. Both fail server validation, so a single delete could block every
 * later save of that scene with a message naming neither the hotspot nor the
 * camera. Assigning a sequence index can collide with one already taken, which
 * the server rejects outright.
 *
 * Pulled out of the panel so the rules are checkable without mounting it, and
 * so the panel keeps only the wiring.
 */

import type { HotspotDefinition } from '@vctrl/core'

/**
 * Removes a hotspot and repairs what pointed at it.
 *
 * Returns the surviving hotspots with any reference to `removedCameraId`
 * cleared and the sequence closed up, so the remaining steps stay contiguous
 * in the order the author arranged.
 */
export const removeHotspot = (
	hotspots: readonly HotspotDefinition[],
	id: string
): HotspotDefinition[] => {
	const removed = hotspots.find((h) => h.id === id)
	const removedCameraId = removed?.linkedCameraId

	const remaining = hotspots
		.filter((h) => h.id !== id)
		.map((h) =>
			removedCameraId && h.linkedCameraId === removedCameraId
				? { ...h, linkedCameraId: undefined }
				: h
		)

	const order = remaining
		.filter((h) => h.sequenceIndex !== undefined)
		.sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0))
	const reindexed = new Map(order.map((h, index) => [h.id, index] as const))

	return remaining.map((h) =>
		reindexed.has(h.id) ? { ...h, sequenceIndex: reindexed.get(h.id) } : h
	)
}

/**
 * Puts one hotspot at `sequenceIndex`, swapping with whoever already held it.
 *
 * Swapping rather than refusing keeps every index unique, which is what the
 * server requires, and matches what someone reordering a sequence expects.
 * Passing `undefined` takes the hotspot out of the sequence.
 */
export const assignSequenceIndex = (
	hotspots: readonly HotspotDefinition[],
	id: string,
	sequenceIndex: number | undefined
): HotspotDefinition[] => {
	const target = hotspots.find((h) => h.id === id)
	if (!target) return [...hotspots]

	// Where the displaced hotspot goes. Normally it takes the slot the target
	// just left. When the target had no slot there is nothing to hand over, so
	// it gets the next free one rather than dropping out of the sequence, which
	// would quietly change playback the author never asked to change.
	const displacedTo =
		target.sequenceIndex ??
		hotspots.reduce(
			(next, h) =>
				h.sequenceIndex === undefined ? next : Math.max(next, h.sequenceIndex + 1),
			0
		)

	return hotspots.map((h) => {
		if (h.id === id) return { ...h, sequenceIndex }
		// Only the holder of the requested index moves.
		return sequenceIndex !== undefined && h.sequenceIndex === sequenceIndex
			? { ...h, sequenceIndex: displacedTo }
			: h
	})
}
