/**
 * The hotspot list rules, without the renderer.
 *
 * Which hotspots are drawn, in what order, and what step number each one shows
 * is decided here rather than in the marker component, and an authoring surface
 * has to agree with a viewing one about all three: a publisher that numbered its
 * own rows would print a step nobody browsing the published scene ever sees.
 *
 * A separate entry point because the package root pulls in the viewer itself -
 * React, three, and drei - and its stylesheet, so a consumer that only wants the
 * numbering would drag all of that into whatever bundle it lands in. This module
 * imports nothing at runtime.
 *
 * A bundler that chunks by path needs telling as well. The platform's
 * `manualChunks` bucketed everything under `packages/viewer` together, so this
 * module still landed in the viewer's chunk - three and R3F behind it - until it
 * was given a bucket of its own.
 */

export {
	resolveHotspotMarkers,
	type HotspotMarker,
	type ResolveHotspotMarkersOptions
} from './components/scene/resolve-hotspot-markers'

/*
  The link rule travels with the field it governs.

  `HotspotMarker.linkUrl` is author-supplied and deliberately unchecked - the
  marker resolver carries it through so a consumer drawing its own hotspot UI
  can see it. That only works if the consumer can also reach the rule deciding
  whether it is safe to put in an `href`, which is the whole reason this module
  exists rather than the package root: it imports nothing at runtime, so a
  consumer gets the rule without three and drei behind it.
*/
export {
	resolveHotspotLink,
	resolveHotspotPopoverContent,
	type HotspotLink,
	type HotspotPopoverContent
} from './components/scene/resolve-hotspot-popover'
