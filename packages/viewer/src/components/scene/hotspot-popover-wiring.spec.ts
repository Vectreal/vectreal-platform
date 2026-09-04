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
		expect(marker).toContain('canReveal: !!content && !!onReveal')
	})

	it('mounts the card only when it is open and has content', () => {
		expect(marker).toContain('{open && content && (')
		expect(marker).toContain('<HotspotPopover')
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

	it('lifts the whole marker out of the closed markers band while open', () => {
		// The card cannot escape the wrapper drei writes a z-index onto, so the
		// wrapper is what has to move.
		expect(marker).toContain('open ? HOTSPOT_OPEN_Z_INDEX_RANGE')
		expect(marker).toContain('const HOTSPOT_OPEN_Z_INDEX_RANGE = [99, 41]')
		expect(marker).toContain('const HOTSPOT_Z_INDEX_RANGE = [40, 0]')
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
		expect(layer).toContain('onReveal={handleReveal}')
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
		// Ordering matters: reported once for the whole activation rather than
		// per branch, so a marker that reveals and flies is not reported twice.
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
