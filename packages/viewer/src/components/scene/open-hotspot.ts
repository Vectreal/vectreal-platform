/**
 * Which marker shows its card, at most one.
 *
 * Two owners, never both at once. A visitor opens a card by clicking its
 * marker, and the viewer keeps that choice (`opened`). An editing surface
 * holds a card open itself (`held`) - the publisher shows the card of the
 * hotspot whose content is being written - and while it does, the visitor's
 * choice is not consulted at all: `null` holds every card closed, which is
 * how leaving the editor's content view closes a card no click opened.
 * `undefined` hands the cards back to the visitor.
 *
 * Occlusion hides either one. A held card is not cleared by it, so the card
 * comes back when the author orbits the marker back into view; a visitor's
 * card is closed outright, by the layer, because nothing would reopen it.
 *
 * Pure, and in `.ts`, so this package's runner covers it.
 */
export function resolveOpenHotspotId(
	held: string | null | undefined,
	opened: string | null,
	occludedIds: ReadonlySet<string>
): string | null {
	const id = held === undefined ? opened : held
	return id !== null && !occludedIds.has(id) ? id : null
}
