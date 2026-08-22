/**
 * Where each hotspot sits in the order a scene plays them back.
 *
 * No camera is involved, so these take the hotspot list on its own rather than
 * the paired state `scene-hotspot-camera-links` works in.
 */

import type { HotspotDefinition } from '@vctrl/core'

const nextFreeSequenceIndex = (
	hotspots: readonly HotspotDefinition[]
): number =>
	hotspots.reduce(
		(next, h) =>
			h.sequenceIndex === undefined
				? next
				: Math.max(next, h.sequenceIndex + 1),
		0
	)

/**
 * Puts one hotspot at `sequenceIndex`, swapping with whoever already held it.
 *
 * Swapping rather than refusing keeps every index unique, which is what the
 * server requires, and matches what someone reordering a sequence expects. A
 * hotspot joining the sequence has no slot to hand over, so the displaced one
 * takes the next free index rather than dropping out of the sequence, which
 * would quietly change playback the author never asked to change.
 */
export function assignSequenceIndex(
	hotspots: readonly HotspotDefinition[],
	id: string,
	sequenceIndex: number | undefined
): HotspotDefinition[] {
	const target = hotspots.find((h) => h.id === id)
	if (!target) return [...hotspots]

	const displacedTo = target.sequenceIndex ?? nextFreeSequenceIndex(hotspots)

	return hotspots.map((h) => {
		if (h.id === id) return { ...h, sequenceIndex }
		return sequenceIndex !== undefined && h.sequenceIndex === sequenceIndex
			? { ...h, sequenceIndex: displacedTo }
			: h
	})
}
