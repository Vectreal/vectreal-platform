/**
 * The three canvas cues, pinned by reading the source.
 *
 * Two of them - the backstage ring and the you-are-here ring - are CSS on a
 * `data-*` attribute, and the third is a `pointerEvents` value. None can be
 * rendered here: this package's runner loads only spec files ending in `.ts`,
 * under `environment: 'node'`. What can go wrong without a test is the wiring,
 * which type-checks perfectly while drawing nothing: an attribute set on the
 * wrong element, a rule whose selector no longer matches it, or a prop
 * computed and never passed.
 *
 * So this asserts that the attribute and the rule that reads it still agree.
 * It cannot tell a good cue from an ugly one.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const marker = readFileSync(
	join(import.meta.dirname, 'hotspot-marker.tsx'),
	'utf8'
)
const layer = readFileSync(
	join(import.meta.dirname, 'scene-hotspots.tsx'),
	'utf8'
)
const viewer = readFileSync(
	join(import.meta.dirname, '../../vectreal-viewer.tsx'),
	'utf8'
)
const styles = readFileSync(
	join(import.meta.dirname, '../../styles.css'),
	'utf8'
)

describe('a backstage marker is drawn as one', () => {
	const internalRule = styles
		.split('.vctrl-viewer-hotspot[data-internal] .vctrl-hotspot-body::after')[1]
		?.split('}')[0]

	it('found the rule to read', () => {
		expect(internalRule).toBeTruthy()
	})

	it('marks the root with what the resolver worked out', () => {
		expect(marker).toContain('data-internal={marker.internal || undefined}')
	})

	it('has a rule that reads that attribute', () => {
		expect(styles).toContain('.vctrl-viewer-hotspot[data-internal]')
	})

	it('rings the marker rather than recolouring it', () => {
		// `hotspotColor` writes the fill as an inline style on the root, and an
		// inline declaration beats any stylesheet rule for the same property, so
		// a fill-based cue would vanish on a branded viewer.
		//
		// The full declaration, not the word `border`: `border-radius` contains
		// it, so a rule reduced to `border: 0` or to nothing but a radius passed
		// while drawing no ring at all.
		expect(internalRule).toContain('border: 1px dashed')
		expect(internalRule).toContain('var(--vctrl-hotspot-internal-ring)')
		expect(internalRule).not.toContain('--vctrl-hotspot-fill')
	})

	it('generates the pseudo-element it draws on', () => {
		// Without `content` the `::after` never exists, so every other
		// declaration in the rule is inert.
		expect(internalRule).toContain("content: ''")
	})

	it('stays distinct from the hidden cue, which desaturates', () => {
		// A marker can be both at once, and the two facts have different
		// remedies, so one treatment must not be the other. Asserted on the
		// INTERNAL rule: reading only the hidden one tested untouched CSS and
		// passed even with the two cues made identical.
		const hidden = styles
			.split('.vctrl-viewer-hotspot[data-hidden] .vctrl-hotspot-body')[1]
			?.split('}')[0]

		expect(hidden).toContain('grayscale')
		expect(internalRule).not.toContain('grayscale')
	})
})

describe('the marker you are standing at says so', () => {
	it('compares the live camera, not the hotspot id', () => {
		// A host activating the camera directly has to light the same marker up
		// as a visitor clicking it.
		expect(layer).toContain('marker.linkedCameraId === activeCameraId')
	})

	it('reads no camera as nobody being here, rather than everybody', () => {
		// Without the guard, `activeCameraId` starts null, an unlinked marker's
		// `linkedCameraId` is null, and `null === null` lights every one of them
		// on load and whenever the scene camera is active - the exact opposite
		// of the cue.
		expect(layer).toContain(
			'!!activeCameraId && marker.linkedCameraId === activeCameraId'
		)
	})

	it('takes the camera from the event, not from the opening prop', () => {
		// `cameraOptions.activeCameraId` is the opening request. A marker click,
		// a host command and an interaction all move the camera without it.
		const handler = viewer
			.split('const handleInteractionEvent = useCallback')[1]
			?.split('\t\t[onInteractionEvent]')[0]

		// A real anchor check, not just truthiness: if the closing split stops
		// matching, `handler` becomes the rest of the file and every assertion
		// below passes on text from somewhere else entirely.
		expect(handler).toBeTruthy()
		expect((handler ?? '').length).toBeLessThan(600)

		// The branch and its body together. `setActiveCameraId(event.cameraId)`
		// appears in both branches, so asserting it alone let the
		// `camera_changed` branch be gutted with the test still green.
		expect(handler).toContain(
			"if (event.type === 'camera_changed') {\n\t\t\t\tsetActiveCameraId(event.cameraId)"
		)
		// Still forwarded: intercepting it must not swallow it.
		expect(handler).toContain('onInteractionEvent?.(event)')
	})

	it('reaches the hotspot layer', () => {
		expect(viewer).toContain('activeCameraId={activeCameraId}')
		expect(marker).toContain('data-current={current || undefined}')
		expect(styles).toContain('.vctrl-viewer-hotspot[data-current]')
	})
})
