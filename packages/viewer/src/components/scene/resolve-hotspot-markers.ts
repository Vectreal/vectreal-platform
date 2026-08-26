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

/**
 * Turns a scene's stored hotspots into the list the viewer draws, in order.
 *
 * Three rules, all of them the author's:
 *
 * - `visible: false` is never drawn. Only an explicit false hides: the field is
 *   required by the type, so an absent one is malformed data, and dropping a
 *   hotspot someone placed is the worse failure of the two.
 * - `internalOnly` is only drawn on an editing surface. The published payload is
 *   already stripped of these server-side (`redactSettingsForEmbed`), so this is
 *   the second of two independent gates rather than the only one: the viewer is
 *   a public npm package and a consumer can hand it any settings object at all,
 *   including one that never passed through that redaction.
 * - Sequenced hotspots come first, in sequence order, then the rest in the order
 *   the author stored them. Order is what `sequenceIndex` means.
 *
 * Everything else here is hardening. The platform's own parser validates most of
 * these fields on save, but it never sees `payloadUrl`, and a direct consumer of
 * `@vctrl/viewer` goes through no parser at all: a non-string `name` would throw
 * on `.trim()` mid-render, and a `NaN` sequence index would make the comparator
 * return `NaN` and leave the order to the sort implementation.
 */
export function resolveHotspotMarkers(
	hotspots: readonly HotspotDefinition[] | undefined,
	{ includeInternal = false }: ResolveHotspotMarkersOptions = {}
): HotspotMarker[] {
	if (!Array.isArray(hotspots)) return []

	const seen = new Set<string>()
	const drawable: {
		hotspot: HotspotDefinition
		id: string
		position: [number, number, number]
	}[] = []

	for (const hotspot of hotspots) {
		if (!hotspot) continue

		const id = text(hotspot.id)
		// Two markers sharing an id would collide on React's key and one of them
		// would inherit the other's occlusion state.
		if (!id || seen.has(id)) continue

		const position = drawablePosition(hotspot.worldPosition)
		if (!position) continue

		if (hotspot.visible === false) continue
		if (!includeInternal && hotspot.internalOnly === true) continue

		seen.add(id)
		drawable.push({ hotspot, id, position })
	}

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

	const stepCount = sequenced.length

	return [
		...sequenced.map(({ entry }, index) =>
			toMarker(entry, index + 1, stepCount)
		),
		...unsequenced.map((entry) => toMarker(entry, null, stepCount))
	]
}

function toMarker(
	{
		hotspot,
		id,
		position
	}: {
		hotspot: HotspotDefinition
		id: string
		position: [number, number, number]
	},
	step: number | null,
	stepCount: number
): HotspotMarker {
	const name = text(hotspot.name) ?? 'Hotspot'
	const payloadUrl = text(hotspot.payloadUrl)

	return {
		id,
		name,
		accessibleName:
			step === null ? name : `${name}, step ${step} of ${stepCount}`,
		position,
		step,
		stepCount,
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
