/**
 * The Lighting tool turns lights only with the globe, which turns the
 * environment and every light together. A light dragged on its own in the
 * scene would leave the environment's bright region it was set against, so
 * the publisher draws no in-scene light handle.
 *
 * A source guard: neither the route module nor the panel can be imported by a
 * test without the whole publisher.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const publisher = read('publisher.$sceneId.tsx')
const panel = read(
	'../../components/publisher/sidebars/compose-sidebar/lighting-settings/lighting-settings-panel.tsx'
)

describe('the Lighting tool turn', () => {
	it('draws no in-scene light handle', () => {
		for (const prop of [
			'shadowLightEditable',
			'editableLightRole',
			'onShadowLightChange'
		]) {
			expect(publisher).not.toContain(prop)
		}
	})

	it('turns the environment, and with it every light, from the globe', () => {
		expect(panel).toMatch(
			/<LightingGlobe[\s\S]*?rotation=\{wrapDegrees\(environment\.rotation\)\}[\s\S]*?environment: \{ \.\.\.prev\.environment, rotation \}/
		)
	})
})
