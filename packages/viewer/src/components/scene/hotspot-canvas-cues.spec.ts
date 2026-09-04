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
		const rule = styles
			.split('.vctrl-viewer-hotspot[data-internal]')[1]
			?.split('}')[0]

		expect(rule).toContain('border')
		expect(rule).not.toContain('--vctrl-hotspot-fill')
	})

	it('stays distinct from the hidden cue, which desaturates', () => {
		// A marker can be both at once, and the two facts have different
		// remedies, so one treatment must not be the other.
		const hidden = styles
			.split('.vctrl-viewer-hotspot[data-hidden] .vctrl-hotspot-body')[1]
			?.split('}')[0]

		expect(hidden).toContain('grayscale')
	})
})

describe('the marker you are standing at says so', () => {
	it('compares the live camera, not the hotspot id', () => {
		// A host activating the camera directly has to light the same marker up
		// as a visitor clicking it.
		expect(layer).toContain('marker.linkedCameraId === activeCameraId')
	})

	it('takes the camera from the event, not from the opening prop', () => {
		// `cameraOptions.activeCameraId` is the opening request. A marker click,
		// a host command and an interaction all move the camera without it.
		const handler = viewer
			.split('const handleInteractionEvent = useCallback')[1]
			?.split('\t\t[onInteractionEvent]')[0]

		expect(handler).toBeTruthy()
		expect(handler).toContain("event.type === 'camera_changed'")
		expect(handler).toContain('setActiveCameraId(event.cameraId)')
		// Still forwarded: intercepting it must not swallow it.
		expect(handler).toContain('onInteractionEvent?.(event)')
	})

	it('reaches the hotspot layer', () => {
		expect(viewer).toContain('activeCameraId={activeCameraId}')
		expect(marker).toContain('data-current={current || undefined}')
		expect(styles).toContain('.vctrl-viewer-hotspot[data-current]')
	})
})
