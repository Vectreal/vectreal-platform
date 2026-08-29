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
	 * Selecting beats activating wherever a surface offers both. Selecting is
	 * local and reversible; activating throws away the viewpoint the author was
	 * working from, so the cheap one has to be what a click gets. A surface that
	 * wants the camera instead says so by not passing a select handler.
	 */
	action: 'select' | 'activate' | 'none'
	/**
	 * True when this button is a selection toggle, so it can carry
	 * `aria-pressed`. Independent of occlusion for the same reason `role` is: a
	 * marker must not change what it announces itself to be mid-orbit.
	 */
	toggles: boolean
	/**
	 * False while occluded, so an invisible marker is not a tab stop. Focus that
	 * is already on it survives, which `disabled` would not allow.
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
		canSelect = false
	}: {
		occluded: boolean
		/** Whether the viewer was given somewhere to send an activation. */
		canActivate: boolean
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
	const isButton = canSelect || canFly

	return {
		role: isButton ? 'button' : 'image',
		action: occluded
			? 'none'
			: canSelect
				? 'select'
				: canFly
					? 'activate'
					: 'none',
		toggles: canSelect,
		focusable: isButton && !occluded,
		pointerEvents: occluded ? 'none' : 'auto'
	}
}
