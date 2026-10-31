/**
 * The light handle turns the legacy key light without resizing it.
 *
 * A source guard: the route module cannot be imported by a test. The viewer
 * draws the handle at a fixed distance while the stored distance is the
 * light's size, so storing the dragged position as it comes would sharpen or
 * soften the shadow on every drag. `aimLegacyLight` is tested in core.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const publisher = readFileSync(
	join(import.meta.dirname, 'publisher.$sceneId.tsx'),
	'utf8'
)

describe('the publisher light handle', () => {
	it('stores the dragged direction at the distance the light already had', () => {
		expect(publisher).toMatch(
			/position: aimLegacyLight\(prev\.light\?\.position, position\)/
		)
	})
})
