/**
 * A live shadow bake waits for the model it is sized from.
 *
 * A source guard, like `idle-convergence-wiring.spec.ts`: components need a
 * WebGL context this runner does not have. drei bakes on mount, and every
 * bake input is in model-size units, so a bake mounted against the placeholder
 * metrics is discarded when the real ones arrive. A viewer opening a scene
 * with no stored bake ran the static bake twice, blocking the main thread
 * for both.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const shadows = readFileSync(
	join(import.meta.dirname, 'scene-shadows.tsx'),
	'utf8'
)

describe('live shadow bakes', () => {
	it('mount only once the model is measured', () => {
		expect(shadows).toMatch(/\) : measured \? \([\s\S]*?\{bake\}/)
		expect(shadows).toContain('{measured && contactShadow}')
	})

	it('read a previous model as unmeasured', () => {
		expect(shadows).toMatch(
			/measurement && measurement\.model === model\s*\? measurement\.metrics/
		)
	})
})
