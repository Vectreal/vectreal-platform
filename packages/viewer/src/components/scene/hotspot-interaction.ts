import type { HotspotMarker } from './resolve-hotspot-markers'

/** How a marker behaves once the depth test has had its say. */
export interface HotspotInteraction {
	/**
	 * `button` for a hotspot a click can do something with, `image` for one that
	 * only labels a point.
	 *
	 * Deliberately independent of occlusion. Swapping the element type mid-orbit
	 * unmounts the focused button, which drops keyboard focus to the document
	 * body and restarts the tab order.
	 */
	role: 'button' | 'image'
	/**
	 * What a click does. `none` while occluded, and for a marker that offers
	 * nothing.
	 *
	 * Precedence is select, then reveal, then activate. Selecting beats
	 * everything wherever a surface offers it: it is local and reversible, while
	 * the others throw away the viewpoint the author was working from, so the
	 * cheap one has to be what a click gets. A surface that wants the content or
	 * the camera instead says so by not passing a select handler.
	 *
	 * Revealing beats activating only in the sense of naming what the button
	 * announces itself as. A marker that has something to say *and* a camera to
	 * fly does both on one click - see `fliesCamera`.
	 */
	action: 'select' | 'reveal' | 'activate' | 'none'
	/**
	 * Whether a click should also move the camera.
	 *
	 * Separate from `action` because the two are not alternatives. A marker
	 * carrying content and a linked camera says "look here, and here is why";
	 * making the author choose which of those a click gets would be a false
	 * choice, and the flight is what puts the popover's subject on screen.
	 */
	fliesCamera: boolean
	/**
	 * Which state this button announces, or null when it announces none.
	 *
	 * A discriminant rather than two booleans: a selection is `aria-pressed` and
	 * a reveal is `aria-expanded`, they cannot both be true of one control, and
	 * a marker carrying both would otherwise announce itself wrongly. Independent
	 * of occlusion for the same reason `role` is: a marker must not change what
	 * it announces itself to be mid-orbit.
	 */
	announces: 'pressed' | 'expanded' | null
	/**
	 * False while occluded, so an invisible marker is not a tab stop. Focus that
	 * is already on it survives, which `disabled` would not allow.
	 *
	 * True for a marker that offers nothing to do, which is not a contradiction:
	 * such a marker still carries a name, and hover is the only other way to
	 * read it. Someone on a keyboard, or on a device with no hover at all, had
	 * no way to reach that name while this tracked `role`.
	 */
	focusable: boolean
	/**
	 * `none` while occluded. A marker faded almost out of sight must not still
	 * swallow a click: it would fly the camera somewhere from a target the
	 * visitor cannot see, and it would pop a label for a marker behind the model.
	 */
	pointerEvents: 'auto' | 'none'
}

export function resolveHotspotInteraction(
	marker: Pick<HotspotMarker, 'linkedCameraId'>,
	{
		occluded,
		canActivate,
		canSelect = false,
		canReveal = false
	}: {
		occluded: boolean
		/** Whether the viewer was given somewhere to send an activation. */
		canActivate: boolean
		/**
		 * Whether this marker has anything to reveal. Content the renderer would
		 * refuse to draw is not content: `resolveHotspotPopoverContent` decides,
		 * so a marker whose only body is an unsafe link stays inert rather than
		 * becoming a button that opens an empty card.
		 */
		canReveal?: boolean
		/**
		 * Whether the viewer was given somewhere to send a selection. An editing
		 * surface passes a select handler only while its own tool is armed, so
		 * "the tool decides" collapses into this one flag and the precedence rule
		 * below stays a plain, testable thing.
		 */
		canSelect?: boolean
	}
): HotspotInteraction {
	const canFly = marker.linkedCameraId !== null && canActivate
	// Selection needs no camera: an editing surface has to be able to pick a
	// marker that names none, which is the whole point of drawing it.
	const isButton = canSelect || canReveal || canFly

	return {
		role: isButton ? 'button' : 'image',
		action: occluded
			? 'none'
			: canSelect
				? 'select'
				: canReveal
					? 'reveal'
					: canFly
						? 'activate'
						: 'none',
		// Not on an editing surface: there a click picks the marker up, and
		// flying away from the viewpoint the author is composing in is the one
		// thing selection exists to avoid.
		fliesCamera: !occluded && !canSelect && canFly,
		announces: canSelect ? 'pressed' : canReveal ? 'expanded' : null,
		// Not `isButton && !occluded`. A marker with nothing to activate is still
		// a marker with a name, and focus is what reveals that name where hover
		// cannot - which is every keyboard, and every touch device.
		focusable: !occluded,
		pointerEvents: occluded ? 'none' : 'auto'
	}
}
