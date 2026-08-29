import type { HotspotDefinition, HotspotStylePreset } from '@vctrl/core'

/**
 * One hotspot, reduced to exactly what the renderer draws.
 *
 * Every decision that can be made without a camera is made here rather than in
 * the component: this package's test runner only loads `.ts`, deliberately, so
 * anything left inside the `.tsx` marker cannot be covered at all.
 */
export interface HotspotMarker {
	id: string
	/** Trimmed, and never empty. */
	name: string
	/** What a screen reader announces, including the step and how many there are. */
	accessibleName: string
	position: [number, number, number]
	/**
	 * 1-based place in the navigation sequence, or null when this hotspot is not
	 * part of one.
	 *
	 * Deliberately not `sequenceIndex + 1`. The stored index only has to be a
	 * unique non-negative integer, and the authoring swap leaves gaps whenever a
	 * hotspot drops out of the sequence, so a scene can legitimately hold
	 * indices 0, 1 and 4. Printing those would tell a visitor there are steps
	 * they cannot find. The rank among the hotspots a visitor can actually reach
	 * is what "step 2 of 3" means to whoever is looking at it.
	 */
	step: number | null
	/** How many steps the sequence has, for the same reason. */
	stepCount: number
	/**
	 * Drawn, but `visible: false` - an editing surface asked to see it so the
	 * author can find it and unhide it. Never true on a public surface, which
	 * drops these entirely.
	 *
	 * Deliberately not set for `internalOnly`. That is a different fact with a
	 * different remedy: a hidden hotspot is one the author switched off, an
	 * internal one is one they meant to keep backstage.
	 */
	hidden: boolean
	/** Never `image` or `svg` without a `payloadUrl` to go with it. */
	preset: HotspotStylePreset
	payloadUrl: string | null
	linkedCameraId: string | null
	occlusionEnabled: boolean
}

export interface ResolveHotspotMarkersOptions {
	/**
	 * Editing surfaces pass true to draw hotspots the author marked
	 * `internalOnly`. Public and embedded viewers never do - see below.
	 */
	includeInternal?: boolean
	/**
	 * Editing surfaces pass true to draw hotspots the author hid
	 * (`visible: false`), so they can be found and switched back on. Neither this
	 * nor `includeInternal` changes a single step number - see below.
	 */
	includeHidden?: boolean
}

/** A trimmed string, or null for anything that is not a usable string. */
function text(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : null
}

/**
 * A hotspot the runtime can place. `worldPosition` reaches the viewer straight
 * from persisted JSON, and a malformed one would throw inside the R3F tree
 * rather than degrade, taking the whole scene down with it.
 */
function drawablePosition(position: unknown): [number, number, number] | null {
	if (!Array.isArray(position) || position.length !== 3) return null
	// `Number.isFinite` does not coerce, so it rejects every non-number on its
	// own; a `typeof` clause beside it would be a branch no input can reach.
	if (!position.every((axis) => Number.isFinite(axis))) return null
	return [position[0], position[1], position[2]]
}

/** What survived the filters, and whether a visitor would have seen it. */
interface DrawableEntry {
	hotspot: HotspotDefinition
	id: string
	position: [number, number, number]
	hidden: boolean
	internal: boolean
	/**
	 * True when a visitor to the published scene would see this hotspot, which
	 * is the only set step numbers are ranked over.
	 */
	published: boolean
}

/**
 * Turns a scene's stored hotspots into the list the viewer draws, in order.
 *
 * Three rules, all of them the author's:
 *
 * - `visible: false` is drawn only where someone can switch it back on, which
 *   an editing surface asks for with `includeHidden`. Only an explicit false
 *   hides: the field is required by the type, so an absent one is malformed
 *   data, and dropping a hotspot someone placed is the worse failure of the two.
 * - `internalOnly` is only drawn on an editing surface. The published payload is
 *   already stripped of these server-side (`redactSettingsForEmbed`), so this is
 *   the second of two independent gates rather than the only one: the viewer is
 *   a public npm package and a consumer can hand it any settings object at all,
 *   including one that never passed through that redaction.
 * - Sequenced hotspots come first, in sequence order, then the rest in the order
 *   the author stored them. Order is what `sequenceIndex` means.
 *
 * **Step rank and `stepCount` are computed over the published set, always.**
 * Every option here decides only what gets *drawn*; a marker a visitor would
 * never see carries `step: null` and is counted by nothing. Without that rule an
 * editing surface and the sidebar beside it disagree the moment a hidden or
 * internal hotspot sits in the sequence: the canvas would print "step 2 of 4"
 * where the visitor gets "step 1 of 3", and every later marker would be off by
 * one. The numbers an author composes against have to be the numbers that ship.
 *
 * A hidden marker keeps its place in this list even though it takes no number,
 * so it is drawn among the steps it sits between rather than pushed to the end.
 * (Only the list order: drei portals each marker into a container it appends on
 * mount and never reorders, so document order - and with it tab order - follows
 * whichever order the markers first mounted in.)
 *
 * Everything else here is hardening. The platform's own parser validates most of
 * these fields on save, but it never sees `payloadUrl`, and a direct consumer of
 * `@vctrl/viewer` goes through no parser at all: a non-string `name` would throw
 * on `.trim()` mid-render, and a `NaN` sequence index would make the comparator
 * return `NaN` and leave the order to the sort implementation.
 */
export function resolveHotspotMarkers(
	hotspots: readonly HotspotDefinition[] | undefined,
	{
		includeInternal = false,
		includeHidden = false
	}: ResolveHotspotMarkersOptions = {}
): HotspotMarker[] {
	if (!Array.isArray(hotspots)) return []

	/*
	  One entry per id, chosen before any option is consulted.

	  Two markers sharing an id would collide on React's key and one would inherit
	  the other's occlusion state, so one of them has to go. Which one cannot be
	  left to the options: while the id was claimed after the visibility filters, a
	  hidden hotspot took it on an editing surface while the published one took it
	  for a visitor, and the two surfaces then disagreed about both the marker and
	  its step - the exact divergence the numbering rule below exists to rule out.

	  First entry wins, except that a published one takes the id from an
	  unpublished one. Both halves are load-bearing. The first makes the choice a
	  pure function of the stored array; the second stops a hidden or internal
	  duplicate from costing a visitor a marker they would otherwise have seen,
	  which claiming strictly-first would do. A Map keeps the position of the first
	  occurrence even when a later entry replaces the value, so the author's
	  ordering survives either way.

	  Only reachable from a direct consumer of this package - the platform's
	  parser rejects duplicate ids on save.
	*/
	const claimed = new Map<string, DrawableEntry>()

	for (const hotspot of hotspots) {
		if (!hotspot) continue

		const id = text(hotspot.id)
		if (!id) continue

		const position = drawablePosition(hotspot.worldPosition)
		if (!position) continue

		const hidden = hotspot.visible === false
		const internal = hotspot.internalOnly === true
		const entry: DrawableEntry = {
			hotspot,
			id,
			position,
			hidden,
			internal,
			published: !hidden && !internal
		}

		const existing = claimed.get(id)
		if (!existing || (!existing.published && entry.published)) {
			claimed.set(id, entry)
		}
	}

	const drawable = [...claimed.values()].filter(
		(entry) =>
			(!entry.hidden || includeHidden) && (!entry.internal || includeInternal)
	)

	const sequenced = drawable
		.flatMap((entry) =>
			Number.isFinite(entry.hotspot.sequenceIndex)
				? [{ entry, order: entry.hotspot.sequenceIndex as number }]
				: []
		)
		.sort((a, b) => a.order - b.order)

	const unsequenced = drawable.filter(
		({ hotspot }) => !Number.isFinite(hotspot.sequenceIndex)
	)

	const stepCount = sequenced.filter(({ entry }) => entry.published).length

	const markers: HotspotMarker[] = []
	let step = 0
	for (const { entry } of sequenced) {
		markers.push(toMarker(entry, entry.published ? ++step : null, stepCount))
	}
	for (const entry of unsequenced) {
		markers.push(toMarker(entry, null, stepCount))
	}

	return markers
}

function toMarker(
	{ hotspot, id, position, hidden }: DrawableEntry,
	step: number | null,
	stepCount: number
): HotspotMarker {
	const name = text(hotspot.name) ?? 'Hotspot'
	const payloadUrl = text(hotspot.payloadUrl)

	return {
		id,
		name,
		accessibleName: accessibleName(name, step, stepCount, hidden),
		position,
		step,
		stepCount,
		hidden,
		// Both payload presets fall back to the dot rather than rendering a broken
		// image: `payloadUrl` is optional on the type, so an author can pick a
		// preset and save before choosing the artwork.
		preset:
			(hotspot.stylePreset === 'image' || hotspot.stylePreset === 'svg') &&
			payloadUrl
				? hotspot.stylePreset
				: 'dot',
		payloadUrl,
		linkedCameraId: text(hotspot.linkedCameraId),
		// Occlusion defaults on: a marker floating in front of the geometry it is
		// pinned behind reads as a bug, and a scene saved before the field existed
		// carries no value at all.
		occlusionEnabled: hotspot.occlusionEnabled !== false
	}
}

/**
 * A hidden marker only exists on an editing surface, and there the one thing
 * its name has to carry is that a visitor will not see it. It never has a step
 * to announce, so the two branches cannot collide.
 */
function accessibleName(
	name: string,
	step: number | null,
	stepCount: number,
	hidden: boolean
): string {
	if (hidden) return `${name}, hidden`
	return step === null ? name : `${name}, step ${step} of ${stepCount}`
}
