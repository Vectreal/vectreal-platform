import type { HotspotMarker } from './resolve-hotspot-markers'

/** How a marker behaves once the depth test has had its say. */
export interface HotspotInteraction {
	/**
	 * `button` for a hotspot that can move the camera, `image` for one that only
	 * labels a point.
	 *
	 * Deliberately independent of occlusion. Swapping the element type mid-orbit
	 * unmounts the focused button, which drops keyboard focus to the document
	 * body and restarts the tab order.
	 */
	role: 'button' | 'image'
	/** False while occluded: see `pointerEvents`. */
	activatable: boolean
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
		canActivate
	}: {
		occluded: boolean
		/** Whether the viewer was given somewhere to send an activation. */
		canActivate: boolean
	}
): HotspotInteraction {
	const isButton = marker.linkedCameraId !== null && canActivate

	return {
		role: isButton ? 'button' : 'image',
		activatable: isButton && !occluded,
		focusable: isButton && !occluded,
		pointerEvents: occluded ? 'none' : 'auto'
	}
}
