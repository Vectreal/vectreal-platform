import type { HotspotMarker } from './resolve-hotspot-markers'

/** A link a marker's popover can offer, once it is safe to render. */
export interface HotspotLink {
	href: string
	/**
	 * What the anchor says. The URL's host, never an author-supplied label:
	 * there is no second field to keep in step with the destination, so the
	 * visible text cannot go stale against where the link points.
	 */
	label: string
}

/** What a marker has to say, or null when it has nothing. */
export interface HotspotPopoverContent {
	body: string | null
	link: HotspotLink | null
}

/** Which side of the marker the popover sits on. */
export type HotspotPopoverSide = 'above' | 'below'

export interface HotspotPopoverPlacement {
	side: HotspotPopoverSide
	/**
	 * Horizontal shift from centred on the marker, in pixels. Non-zero only
	 * where a centred popover would leave the canvas.
	 */
	offsetX: number
}

export interface HotspotPopoverPlacementInput {
	/** The marker's centre, in canvas coordinates. */
	anchor: { x: number; y: number }
	/** The popover's measured size. */
	size: { width: number; height: number }
	/** The canvas the popover has to stay inside. */
	bounds: { width: number; height: number }
	/** Clearance between the marker's centre and the popover's near edge. */
	gap: number
	/** Clearance kept between the popover and the edge of the canvas. */
	margin: number
}

/**
 * A marker's link, or null.
 *
 * `https:` only, and the check is the prefix rather than the parsed protocol,
 * because this is a security gate and a prefix cannot be talked out of its
 * answer. The parse that follows only reads the host for the label.
 *
 * The platform's save parser applies the same rule, so this is the second of
 * two independent gates rather than the only one - the same arrangement
 * `internalOnly` has. It is load-bearing here for the same reason: this package
 * ships to npm, a consumer can hand it any settings object at all, and this
 * value lands in an `<a href>` where `javascript:` executes.
 */
export function resolveHotspotLink(value: string | null): HotspotLink | null {
	if (!value) return null
	if (!value.toLowerCase().startsWith('https://')) return null

	try {
		// Behind that prefix, `new URL` either throws or yields a non-empty host -
		// `https://`, `https://?a=1` and `https://:443` all throw - so there is no
		// empty-host case left to branch on here.
		return { href: value, label: new URL(value).host }
	} catch {
		// It does still throw on values the prefix check alone does not rule out:
		// `https://` followed by a bare space is one.
		return null
	}
}

/**
 * What a marker reveals when it is opened, or null when it reveals nothing.
 *
 * A marker whose only content is a link the rule above refuses has nothing to
 * reveal, which is what keeps an unsafe link from turning an otherwise inert
 * marker into a button that opens an empty card.
 */
export function resolveHotspotPopoverContent(
	marker: Pick<HotspotMarker, 'body' | 'linkUrl'>
): HotspotPopoverContent | null {
	const body = marker.body
	const link = resolveHotspotLink(marker.linkUrl)

	if (!body && !link) return null
	return { body, link }
}

/**
 * Where to draw an open popover so it stays on the canvas.
 *
 * Above the marker by default, because that is where the hover label already
 * appears and a card below a marker covers the geometry the marker is pointing
 * at. It flips below only when it does not fit above, and shifts sideways only
 * as far as it takes to stay inside the canvas.
 *
 * Total by construction: when neither side fits, the roomier one wins rather
 * than a default that guarantees a clipped card.
 *
 * Pure, and measured in canvas coordinates rather than page coordinates, so
 * an embedded viewer inside a scrolled host page places the same as a
 * full-page one.
 */
export function resolveHotspotPopoverPlacement({
	anchor,
	size,
	bounds,
	gap,
	margin
}: HotspotPopoverPlacementInput): HotspotPopoverPlacement {
	const roomAbove = anchor.y - gap - margin
	const roomBelow = bounds.height - anchor.y - gap - margin

	const side: HotspotPopoverSide =
		size.height <= roomAbove
			? 'above'
			: size.height <= roomBelow
				? 'below'
				: roomBelow > roomAbove
					? 'below'
					: 'above'

	const centredLeft = anchor.x - size.width / 2
	// `max` last, so a popover wider than the canvas pins to the left margin
	// rather than being pushed off the other side by the clamp meant to keep it
	// on screen.
	const clampedLeft = Math.max(
		margin,
		Math.min(centredLeft, bounds.width - size.width - margin)
	)

	return { side, offsetX: clampedLeft - centredLeft }
}
