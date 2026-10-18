import { describe, expect, it } from 'vitest'

import { resolveOpenHotspotId } from './open-hotspot'

const none: ReadonlySet<string> = new Set()

describe('resolveOpenHotspotId', () => {
	it("follows the visitor's choice while no surface holds a card", () => {
		expect(resolveOpenHotspotId(undefined, 'knob', none)).toBe('knob')
		expect(resolveOpenHotspotId(undefined, null, none)).toBeNull()
	})

	it('lets a holding surface override the visitor, either way', () => {
		expect(resolveOpenHotspotId('lens', 'knob', none)).toBe('lens')
		// The case that closes a card opened in preview once the editor takes over.
		expect(resolveOpenHotspotId(null, 'knob', none)).toBeNull()
	})

	it('hides an occluded card, whoever opened it', () => {
		const occluded = new Set(['knob'])
		expect(resolveOpenHotspotId(undefined, 'knob', occluded)).toBeNull()
		expect(resolveOpenHotspotId('knob', null, occluded)).toBeNull()
		expect(resolveOpenHotspotId('lens', null, occluded)).toBe('lens')
	})
})
