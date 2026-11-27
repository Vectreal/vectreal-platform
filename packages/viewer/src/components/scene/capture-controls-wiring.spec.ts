/**
 * A capture clamps to the visitor's limits when the host's live controls are
 * not the visitor's.
 *
 * A source guard, for the reason `viewport-framing-wiring.spec.ts` gives:
 * `SceneModel` needs a WebGL context this runner does not have. The Publisher's
 * editor moves freely (below the horizon, past the scene's distance limits),
 * and without this its thumbnails and opening views clamp to those free limits
 * while the visitor's controls clamp the same pose somewhere else.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) =>
	readFileSync(join(import.meta.dirname, path), 'utf8')

const model = read('scene-model.tsx')
const viewer = read('../../vectreal-viewer.tsx')

describe('captures clamp to the visitor’s controls', () => {
	it('hands the visitor’s controls to the model layer', () => {
		expect(viewer).toContain('captureControls={captureControlsOptions}')
	})

	it('takes the angle and distance limits from them when given', () => {
		// Falling back to the visitor's default, not OrbitControls' free orbit.
		expect(model).toMatch(
			/maxPolarAngle:\s*captureControls\.maxPolarAngle \?\?\s*defaultControlsOptions\.maxPolarAngle/
		)
		expect(model).toContain('minDistance: captureControls.minDistance')
	})
})
