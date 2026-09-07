/**
 * Deciding whether a scene's hotspots differ from what is already stored.
 *
 * Hotspots live in their own table rather than on the settings row, so the
 * comparison takes the separately loaded list instead of reading a field. That
 * separation is also what made them easy to miss: while they were absent from
 * the comparison, renaming a hotspot, moving it, toggling its visibility or
 * reordering its sequence was dropped and answered with a success response.
 * Adding one happened to survive, which is why the gap went unnoticed for so
 * long, but only because the panel also mints a paired camera and that dirtied
 * `camera`.
 */

/**
 * Structural minimum for a hotspot on either side of the comparison.
 *
 * Loosely typed on purpose: one side is client-supplied and has already been
 * validated by the settings parser, the other is mapped straight off database
 * rows, and the two disagree about whether an absent value is `undefined` or
 * `null`.
 */
interface HotspotLike {
	id?: string
	name?: string
	body?: string | null
	linkUrl?: string | null
	worldPosition?: readonly number[]
	linkedCameraId?: string | null
	visible?: boolean
	internalOnly?: boolean
	sequenceIndex?: number | null
	stylePreset?: string
	payloadUrl?: string | null
	occlusionEnabled?: boolean
}

/**
 * Positions are stored in `real` columns, which are single precision, so a
 * value written as a double comes back rounded. Comparing exactly would report
 * every scene containing a hotspot as changed on every save. This tolerance is
 * just above single-precision resolution and well below anything an author
 * could place by hand.
 */
const POSITION_EPSILON = 1e-5

const samePosition = (
	a: readonly number[] | undefined,
	b: readonly number[] | undefined
): boolean => {
	const left = a ?? []
	const right = b ?? []
	if (left.length !== right.length) return false
	return left.every((value, i) => {
		const other = right[i]
		const scale = Math.max(1, Math.abs(value), Math.abs(other))
		return Math.abs(value - other) <= POSITION_EPSILON * scale
	})
}

/**
 * Absent and null both mean "not set": the client omits the field, the
 * database row carries null. Empty string is deliberately not folded in, since
 * no producer sends one and treating it as unset would hide a real edit.
 */
const sameOptional = (
	a: string | null | undefined,
	b: string | null | undefined
): boolean => (a ?? null) === (b ?? null)

/**
 * Every field is enumerated by hand, which is why a field added to
 * `HotspotDefinition` and forgotten here leaves Save disabled after an author
 * edits it - the save button is driven by this comparison. This is the third
 * hand-maintained enumeration of the hotspot shape, after the draft payload and
 * `toSceneSettings`, so `scene-hotspot-comparison.spec.ts` reads
 * `HotspotDefinition` out of the core type and asserts every field name appears
 * below. Adding a field to the type and not to this function fails that test.
 */
const sameHotspot = (a: HotspotLike, b: HotspotLike): boolean =>
	a.name === b.name &&
	a.visible === b.visible &&
	a.internalOnly === b.internalOnly &&
	a.stylePreset === b.stylePreset &&
	// Absent means enabled, which is what the column defaults to and what the
	// authoring panel falls back to.
	(a.occlusionEnabled ?? true) === (b.occlusionEnabled ?? true) &&
	(a.sequenceIndex ?? null) === (b.sequenceIndex ?? null) &&
	sameOptional(a.body, b.body) &&
	sameOptional(a.linkUrl, b.linkUrl) &&
	sameOptional(a.linkedCameraId, b.linkedCameraId) &&
	sameOptional(a.payloadUrl, b.payloadUrl) &&
	samePosition(a.worldPosition, b.worldPosition)

/**
 * Matched by id rather than by array position: list order is not stored, so
 * reordering the array without touching `sequenceIndex` is not a change.
 */
export const haveHotspotsChanged = (
	current: readonly HotspotLike[] | undefined,
	existing: readonly HotspotLike[] | undefined
): boolean => {
	const incoming = current ?? []
	const stored = existing ?? []

	if (incoming.length !== stored.length) return true

	const storedById = new Map(stored.map((h) => [h.id, h]))

	return incoming.some((hotspot) => {
		const match = storedById.get(hotspot.id)
		return !match || !sameHotspot(hotspot, match)
	})
}
