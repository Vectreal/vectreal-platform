/**
 * A white ring inside a dark halo, for a control drawn over the scene.
 *
 * Both halves, because the ring lands on whatever is behind the control - the
 * model, or a host page of any colour - and a single colour vanishes against
 * one of them. Independent of the fill too, so a focused hotspot marker is
 * distinguishable from the marker itself whatever colour it is.
 */
export const FOCUS_RING =
	'vv:focus-visible:outline-2 vv:focus-visible:outline-offset-2 vv:focus-visible:outline-white vv:focus-visible:shadow-[0_0_0_4px_rgba(0,0,0,0.5)]'

/**
 * The same ring, drawn inside the viewer's own edge: the viewer usually fills
 * its frame, and a host's `overflow: hidden` would clip a ring drawn outside.
 */
export const VIEWER_FOCUS_RING =
	'vv:focus-visible:outline-solid vv:focus-visible:outline-2 vv:focus-visible:-outline-offset-2 vv:focus-visible:outline-white'
