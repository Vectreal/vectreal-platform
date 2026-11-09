import { describe, expect, it } from 'vitest'

import { DEAD_CLICKS_CONFIG, RAGECLICK_CONFIG } from './frustration-signals'

describe.each([
	['rage clicks', RAGECLICK_CONFIG, '.ph-no-rageclick'],
	['dead clicks', DEAD_CLICKS_CONFIG, '.ph-no-deadclick']
])('%s', (_, config, defaultClass) => {
	it('ignores a click on a 3D viewer canvas', () => {
		expect(config.css_selector_ignorelist).toContain('canvas')
	})

	it("keeps posthog-js's default opt-out classes, which a list replaces", () => {
		expect(config.css_selector_ignorelist).toEqual(
			expect.arrayContaining([defaultClass, '.ph-no-capture'])
		)
	})
})
