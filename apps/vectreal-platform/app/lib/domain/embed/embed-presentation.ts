/**
 * How the embed's hotspots appear, read from the iframe's own URL.
 *
 * A separate channel from `useInitialCommands`, and not for tidiness: those are
 * `ViewerCommand`s, executed once when the viewer reports ready. None of these
 * is a command. Suppressing the markers is not something the viewer does at a
 * moment, it is something it is - so expressing it as a command would mean the
 * markers drawing first and disappearing on the ready event.
 *
 * Every option here is for a host page that has taken part of the job over:
 * driving navigation from the hotspot descriptors in the handshake, or drawing
 * its own panel from `hotspot_activated`. Where two UIs would otherwise compete,
 * this is how the host says which one wins.
 */

export interface EmbedHotspotPresentation {
	/**
	 * Whether the viewer draws the markers at all.
	 *
	 * False leaves the hotspots resolved but undrawn, so `focus_hotspot` still
	 * flies a camera by id and the handshake still lists them. A host driving
	 * its own navigation needs exactly that: no markers on the model, and every
	 * hotspot still reachable.
	 */
	showMarkers: boolean
	/**
	 * Whether a marker opens a card of its own.
	 *
	 * False still activates: the camera flies and `hotspot_activated` fires, so
	 * a host drawing its own panel gets the event without the viewer drawing a
	 * second copy of the same text over the model.
	 */
	revealContent: boolean
	/** Overrides the marker fill. Undefined keeps the viewer's neutral default. */
	color: string | undefined
}

/**
 * A CSS colour a host may set the markers to.
 *
 * A hex literal only, and validated rather than passed through, because this
 * value lands in an inline `style` on the marker root. Accepting arbitrary CSS
 * there would let a URL parameter close the declaration and add its own -
 * `red; background: url(...)` - which is a query string writing style into the
 * page. Hex covers what a brand colour is and nothing else.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/**
 * `0` is off and anything else is on, matching `?autoRotate`.
 *
 * An absent parameter reads as on, which is also the default, so there is no
 * separate fallback to carry: both of these are drawn unless the host says
 * otherwise.
 */
const isOn = (value: null | string): boolean => value !== '0'

export function resolveEmbedHotspotPresentation(
	params: URLSearchParams
): EmbedHotspotPresentation {
	const color = params.get('hotspotColor')?.trim()

	return {
		showMarkers: isOn(params.get('hotspots')),
		revealContent: isOn(params.get('hotspotContent')),
		color: color && HEX_COLOR.test(color) ? color : undefined
	}
}
