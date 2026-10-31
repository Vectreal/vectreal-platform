/**
 * The light handle aims the light the Lighting tool has open.
 *
 * A source guard: the route module cannot be imported by a test. The viewer
 * reports the dragged handle as a position, while a light is stored as a
 * direction relative to the environment's rotation, so the position has to be
 * turned back by that rotation and written to the open light, not the key.
 * `aimLight` is tested in core.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const publisher = readFileSync(
	join(import.meta.dirname, 'publisher.$sceneId.tsx'),
	'utf8'
)

describe('the publisher light handle', () => {
	it('stores the dragged direction relative to the environment rotation', () => {
		expect(publisher).toMatch(
			/aimLight\(position, prev\.environment\?\.rotation \?\? 0\)/
		)
	})

	it('moves the light the panel has open', () => {
		expect(publisher).toMatch(
			/light\.role === editedLightRole\s*\?\s*\{ \.\.\.light, \.\.\.direction \}/
		)
		expect(publisher).toContain(
			'editableLightRole={editedLightRole ?? undefined}'
		)
	})

	// The viewer draws a handle only for a light it draws (`litLights`), and
	// otherwise falls back to another light, so a handle shown for an unlit
	// one would sit on that other light and move this one.
	it('shows the handle only for a light the viewer draws', () => {
		expect(publisher).toMatch(
			/light\.role === editedLightRole && light\.enabled && light\.intensity > 0/
		)
	})
})
