/**
 * The `.tsx` half of the reveal, pinned by reading the source.
 *
 * This package's test runner loads only spec files ending in `.ts`, under
 * `environment: 'node'`, deliberately, so a component cannot be rendered here at all. Every
 * decision the reveal makes therefore lives in `resolve-hotspot-popover.ts` and
 * `hotspot-interaction.ts`, which have their own specs. What is left in the
 * components is wiring - and wiring is exactly what type-checks cleanly while
 * doing nothing, which is how a complete renderer once shipped with no surface
 * calling it.
 *
 * So this asserts the calls, not the behaviour. It cannot tell a correct
 * popover from a broken one; it can tell one that is mounted from one that is
 * not. Renaming a local here is meant to fail it - re-point the guard rather
 * than deleting it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) =>
	readFileSync(join(import.meta.dirname, file), 'utf8')

const marker = read('hotspot-marker.tsx')
const layer = read('scene-hotspots.tsx')
const popover = read('hotspot-popover.tsx')
const viewer = read('../../vectreal-viewer.tsx')

describe('the marker reaches the reveal decisions', () => {
	it('asks the resolver what there is to reveal, rather than reading fields', () => {
		expect(marker).toContain('resolveHotspotPopoverContent(marker)')
		// The link rule lives behind that resolver. A marker reading `linkUrl`
		// straight would be rendering an unchecked href.
		expect(marker).not.toContain('marker.linkUrl')
	})

	it('tells the interaction resolver whether there is anything to reveal', () => {
		expect(marker).toContain('canReveal: !!content')
	})

	it('mounts the card only when it is open and has content', () => {
		expect(marker).toContain('{open && content && (')
		expect(marker).toContain('<HotspotPopover')
	})
})

describe('the card is placed by the resolver that was tested', () => {
	/**
	 * The failure this exists for: ten thorough tests over
	 * `resolveHotspotPopoverPlacement` say nothing about whether anything calls
	 * it. Delete the measurement and every one of them stays green while the
	 * card reverts to its default placement and clips at every edge.
	 */
	it('measures and calls the resolver', () => {
		expect(marker).toContain('resolveHotspotPopoverPlacement({')
		expect(marker).toContain('getBoundingClientRect()')
		expect(marker).toContain('setPlacement((previous) =>')
	})

	it('measures in the R3F tree, never inside the portal', () => {
		// drei renders `Html` children through `ReactDOM.createRoot`, so a
		// component in there inherits no canvas context: `useThree` and
		// `useFrame` throw, and the failing root empties its container, taking
		// the marker's own DOM with it. The card must stay presentational.
		expect(marker).toContain('useThree((state) => state.gl.domElement)')
		// The calls, not the words: the card's own docblock names both hooks in
		// prose to explain why it must not call them.
		expect(popover).not.toContain('useFrame(')
		expect(popover).not.toContain('useThree(')
	})

	it('hands the card its placement rather than letting it decide', () => {
		expect(marker).toContain('placement={placement}')
		expect(popover).toContain('popoverClasses[placement.side]')
		// `offsetX` is the half that stops the card clipping at the LEFT and
		// right edges, and its only route to the screen is this one custom
		// property. Pinning `side` alone left four resolver cases unreachable.
		expect(popover).toContain(
			"'--vctrl-hotspot-popover-shift': `calc(-50% + ${placement.offsetX}px)`"
		)
	})

	it('measures the gap from the same point the resolver does', () => {
		// The resolver treats `gap` as clearance from the marker's CENTRE. The
		// card's CSS offset has to agree: `calc(100% + gap)` measured from the
		// marker root's edge instead, so both `roomAbove` and `roomBelow` were
		// over-permissive by half the hit box and a card that "fit" drew off
		// the canvas.
		expect(popover).not.toContain('calc(100%')
		expect(popover).toContain(
			"above: 'bottom-[var(--vctrl-hotspot-popover-gap)]'"
		)
		expect(popover).toContain("below: 'top-[var(--vctrl-hotspot-popover-gap)]'")
		// And being centre-relative, it has to clear half the 24px hit box -
		// 14px for the image and svg presets.
		const gap = /const ANCHOR_GAP_PX = (\d+)/.exec(marker)?.[1]
		expect(Number(gap)).toBeGreaterThan(14)
	})

	it('reseeds the placement timer when the card closes', () => {
		// The ref outlives the card, unlike the one it replaced. Without the
		// reseed the next open resumes part-way through the interval and draws
		// at the previous open's placement until the first measurement lands.
		const frame = marker
			.split('useFrame((_state, delta) => {')[1]
			?.split('\n\t})')[0]

		expect(frame).toBeTruthy()
		expect((frame ?? '').length).toBeLessThan(1600)
		expect(frame).toContain(
			'if (!open) {\n\t\t\tplacementElapsed.current = PLACEMENT_INTERVAL_SECONDS'
		)
		// And the reset only counts a frame that actually measured.
		expect((frame ?? '').indexOf('if (!anchor || !card) return')).toBeLessThan(
			(frame ?? '').indexOf('placementElapsed.current = 0')
		)
	})

	it('gives the open card a portal of its own for the z-index', () => {
		// Two reasons, both drei's: the marker's wrapper is a stacking context
		// the card cannot escape, and swapping `zIndexRange` on a mounted `Html`
		// only takes effect on a frame where the projection moved - which never
		// happens for a content-only marker on a still camera.
		expect(marker).toContain('zIndexRange={HOTSPOT_OPEN_Z_INDEX_RANGE}')
		expect(marker).toContain('zIndexRange={HOTSPOT_Z_INDEX_RANGE}')
	})

	it('renders what the content resolver returned', () => {
		expect(popover).toContain('{content.body}')
		expect(popover).toContain('href={content.link.href}')
		expect(popover).toContain('{content.link.label}')
	})
})

describe('the marker announces the card it opens', () => {
	it('carries aria-expanded from the interaction, not from the content', () => {
		// Occlusion changes what a click does but must not change what the
		// control claims to be, which is why this reads `announces`.
		expect(marker).toContain("interaction.announces === 'expanded' ? open")
	})

	it('names the open card from the button', () => {
		expect(marker).toContain('aria-controls')
		expect(marker).toContain('popoverId')
		expect(popover).toContain('id={id}')
	})

	it('closes on Escape and puts focus back on the marker', () => {
		expect(marker).toContain("event.key !== 'Escape'")
		expect(marker).toContain('buttonRef.current?.focus()')
		// Non-modal: a visitor has to be able to tab out to the next marker
		// while this is open, so nothing may trap focus.
		expect(marker).not.toContain('focusTrap')
	})

	it('keeps the two z-index bands apart', () => {
		expect(marker).toContain('const HOTSPOT_OPEN_Z_INDEX_RANGE = [99, 41]')
		expect(marker).toContain('const HOTSPOT_Z_INDEX_RANGE = [40, 0]')
	})

	it('gives the marker one fixed band, whatever the card is doing', () => {
		// Asserted as a count rather than as the absence of one prior spelling:
		// a differently-named ternary, or the same one wrapped across lines by
		// the formatter, would slip past a `not.toContain`.
		expect(marker.split('HOTSPOT_Z_INDEX_RANGE').length - 1).toBe(2)
	})
})

describe('a marker with nothing to do is still reachable', () => {
	it('takes a focus stop on the non-button branch', () => {
		const imageBranch = marker.split('role="img"')[1]?.split('>')[0]

		expect(imageBranch).toContain('tabIndex={interaction.focusable ? 0 : -1}')
	})

	it('shows its name on focus, which is the only reason the stop exists', () => {
		const imageBranch = marker.split('role="img"')[1]?.split('>')[0]

		expect(imageBranch).toContain('onFocus={showLabel}')
		expect(imageBranch).toContain('onBlur={hideLabel}')
	})

	it('draws a focus ring, so the stop is visible as well as reachable', () => {
		expect(marker).toContain('cn(bodyClasses, FOCUS_RING)')
	})
})

describe('the hotspot layer owns which card is open', () => {
	it('opens at most one, toggling the one already open shut', () => {
		expect(layer).toContain('previous === id ? null : id')
	})

	it('hands each marker its own open state and the toggle', () => {
		expect(layer).toContain('open={marker.id === openId}')
		expect(layer).toContain('handleReveal')
	})

	it('closes a card whose marker went behind the model or left the list', () => {
		// An occluded marker takes no pointer events and offers no action, so a
		// card left open over it is the one state with no way to dismiss.
		expect(layer).toContain('occludedIds.has(openId)')
		expect(layer).toContain('!markers.some((marker) => marker.id === openId)')
	})

	it('asks for a frame when a card opens', () => {
		// The card measures its own placement from a frame, and under
		// `frameloop="demand"` nothing else would request one.
		const handleReveal = layer
			.split('const handleReveal =')[1]
			?.split('\n\t/**')[0]

		expect(handleReveal).toBeTruthy()
		expect(handleReveal).toContain('setOpenId(')
		expect(handleReveal).toContain('invalidate()')
	})
})

describe('an activation is reported to whoever is listening', () => {
	it('reports before either half of the activation, so both are covered', () => {
		const click = marker
			.split('const handleClick = useCallback')[1]
			?.split('\t}, [')[0]

		expect(click).toBeTruthy()
		// Asserted present BEFORE the ordering comparison, and not folded into
		// it: `indexOf` answers -1 for a call that is not there at all, and -1
		// is less than every real index, so the ordering check alone passed
		// with the report deleted outright.
		expect((click ?? '').length).toBeLessThan(1000)
		// A COUNT, which is what "once" means. `indexOf` finds the first match,
		// so an ordering check alone passed both with the call deleted (-1 is
		// less than everything) and with a second call added inside the reveal
		// branch - the duplication this comment is about.
		expect(
			(click ?? '').split('onActivated?.(marker.id, marker.linkedCameraId)')
				.length - 1
		).toBe(1)
		// Reported before either half, so a marker that reveals and flies is
		// reported once rather than per branch.
		expect(
			(click ?? '').indexOf('onActivated?.(marker.id, marker.linkedCameraId)')
		).toBeLessThan((click ?? '').indexOf("interaction.action === 'reveal'"))
	})

	it('reports nothing for a selection, or for an inert marker', () => {
		const click = marker
			.split('const handleClick = useCallback')[1]
			?.split('\t}, [')[0]

		// Selection returns before the report: an editing surface picking a
		// marker up is not a visitor doing anything with it.
		expect(click).toContain("if (interaction.action === 'select') {")
		expect(click).toContain("if (interaction.action === 'none') return")
	})

	it('reaches the viewer, which turns it into an interaction event', () => {
		expect(layer).toContain('onActivated={onHotspotActivated}')
		expect(viewer).toContain('onHotspotActivated={handleHotspotActivated}')
		expect(viewer).toContain("type: 'hotspot_activated'")
	})
})

describe('a host can focus a hotspot the way a click would', () => {
	const focusHotspot = layer
		.split('const focusHotspot = useCallback')[1]
		?.split('\t\t[invalidate')[0]

	it('found the executor to read', () => {
		expect(focusHotspot).toBeTruthy()
	})

	it('resolves the id against the drawn markers, never the stored settings', () => {
		// A hotspot the author hid or kept internal is not in that list on a
		// public surface, so a stale host list cannot reach one by id.
		expect(focusHotspot).toContain('markersRef.current.find(')
		expect(focusHotspot).toContain('if (!marker) return')
	})

	it('does what a click does: reveal, and fly if there is a camera', () => {
		expect(focusHotspot).toContain('resolveHotspotPopoverContent(marker)')
		expect(focusHotspot).toContain('setOpenId(marker.id)')
		expect(focusHotspot).toContain('onActivateCamera?.(marker.linkedCameraId)')
	})

	it('reports no activation, which would echo the host back to itself', () => {
		expect(focusHotspot).not.toContain('onHotspotActivated')
	})

	it('reads the list from a ref, so registering it is not re-run per edit', () => {
		// A dependency that changed with the list would unregister and
		// re-register the executor on every edit, which is the shape that has
		// left this viewer with no executor at all before.
		expect(layer).toContain('const markersRef = useRef(markers)')
		expect(focusHotspot).not.toContain('markers.find(')
	})

	it('is registered with the viewer, which routes the command to it', () => {
		expect(layer).toContain("command.type === 'focus_hotspot'")
		expect(viewer).toContain(
			'onCommandExecutorReady={handleSceneHotspotsExecutorReady}'
		)
		expect(viewer).toContain("case 'focus_hotspot':")
	})
})

describe('a host can take the hotspot UI over', () => {
	it('draws nothing when the markers are suppressed', () => {
		expect(layer).toContain('if (markers.length === 0 || !showMarkers)')
	})

	it('keeps them resolved, so a focus command still flies a camera', () => {
		// Suppressing by passing no `hotspots` would break `focus_hotspot` and
		// empty the handshake, which is the opposite of what a host driving its
		// own navigation needs.
		const markersMemo = layer
			.split('const markers = useMemo')[1]
			?.split(')\n')[0]

		// A negative assertion over a slice that could be empty passes
		// vacuously, and a broken anchor makes that MORE likely - so the slice
		// is pinned before it is judged.
		expect(markersMemo).toContain('resolveHotspotMarkers(hotspots, {')
		expect(markersMemo).not.toContain('showMarkers')
	})

	it('stops raycasting for an occlusion nobody can see', () => {
		expect(layer).toContain('if (model && showMarkers) {')
	})

	it('withholds the reveal handler rather than branching inside the marker', () => {
		expect(layer).toContain(
			'onReveal={revealContent ? handleReveal : undefined}'
		)
	})

	it('keeps a content-only marker activatable when the host draws the card', () => {
		// The defect this replaced: `canReveal` was `!!content && !!onReveal`,
		// so suppressing the card made a marker with body text and no camera a
		// role="img" with no click handler - no flight, no event, nothing for
		// the host to draw its own card from. Which is the one marker the
		// option exists for.
		expect(marker).toContain('canReveal: !!content')
		expect(marker).not.toContain('canReveal: !!content && !!onReveal')
		expect(marker).toContain('revealsInPlace: !!onReveal')
	})

	it('will not open a card the host asked it not to draw', () => {
		// Otherwise a host that suppressed the card and then called
		// `focusHotspot` got one drawn anyway - and could not close it, since
		// neither the click path nor Escape reaches a handler never passed.
		const focus = layer
			.split('const focusHotspot = useCallback')[1]
			?.split('\t\t[invalidate')[0]

		expect(focus).toBeTruthy()
		expect((focus ?? '').length).toBeLessThan(800)
		expect(focus).toContain('revealContent && resolveHotspotPopoverContent(')
	})

	it('reaches the viewer prop a host page sets', () => {
		expect(viewer).toContain('showMarkers={showHotspotMarkers}')
		expect(viewer).toContain('revealContent={revealHotspotContent}')
	})
})

describe('the card is safe to put inside a third-party page', () => {
	it('opens a link in a new context that cannot reach back', () => {
		expect(popover).toContain('rel="noopener noreferrer"')
		expect(popover).toContain('target="_blank"')
	})

	it('takes the pointer back from the wrapper that refuses it', () => {
		// The marker's `Html` wrapper is `pointerEvents: 'none'`, so anything
		// inside it that has to be clickable says so itself.
		expect(popover).toContain('pointer-events-auto')
	})
})
