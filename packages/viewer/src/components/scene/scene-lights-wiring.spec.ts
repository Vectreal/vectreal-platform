/**
 * The scene's lights reach the canvas, measured against the map it shows.
 *
 * A source guard, like `environment-prefetch-wiring.spec.ts`: the lights need
 * a WebGL context this runner does not have. `scene-lighting.spec.ts` proves
 * the rules; this proves the viewer reaches them. A well-tested light rig that
 * nothing mounts, or one measured against a different map than the scene
 * shows, type-checks and passes every unit test.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) =>
	readFileSync(join(import.meta.dirname, file), 'utf8')

const viewer = read('../../vectreal-viewer.tsx')
const lights = read('scene-lights.tsx')

describe('the scene lights', () => {
	it('are mounted from the resolved lighting, with the map the scene loads', () => {
		expect(viewer).toMatch(
			/<SceneLights\s+lighting=\{resolvedLighting\}\s+environmentFiles=\{sceneFiles\}/
		)
		expect(viewer).toMatch(/<SceneShadows\s+lighting=\{resolvedLighting\}/)
	})

	it('measure the map from the loader cache the environment fills', () => {
		expect(lights).toContain(
			'const texture = useEnvironment({ files: environmentFiles })'
		)
		expect(lights).toContain('environmentIrradiance(texture)')
	})

	it('scale each light by its strength, the measured map and its brightness', () => {
		expect(lights).toMatch(
			/light\.intensity \* irradiance \* lighting\.environment\.intensity/
		)
	})

	it('turn with the environment', () => {
		expect(lights).toContain('rotation={lighting.environment.rotation}')
		expect(lights).toContain('lightDirection(light, rotation)')
	})
})
