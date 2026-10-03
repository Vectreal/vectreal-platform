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
	it('mount only once the model is sized', () => {
		expect(shadows).toMatch(/\) : sized \? \([\s\S]*?\{bake\}/)
		expect(shadows).toContain('{sized && contactShadow}')
	})

	it('treat a viewer of children alone as sized', () => {
		expect(shadows).toContain(
			'if (!model) return { ...DEFAULT_METRICS, sized: true }'
		)
	})

	it('treat a model with no measurable bounds as sized', () => {
		expect(shadows).toContain(': { ...DEFAULT_METRICS, sized: true }')
	})

	it('read a previous model as unmeasured, at its own size', () => {
		expect(shadows).toMatch(
			/measurement\.model === model\s*\? measurement\.metrics\s*: \{ \.\.\.measurement\.metrics, measured: false, sized: false \}/
		)
	})
})

describe('a persisted bake', () => {
	it('is chosen by the validity rule, with its basis', () => {
		expect(shadows).toMatch(
			/const usePersistedBake = useMemo\([\s\S]*?isPersistedBakeValid\(bakedShadow, bakeOptions, \{\s*\.\.\.bakeBasis,\s*measured\s*\}\)/
		)
	})

	it('is captured for a save with the basis it was validated against', () => {
		expect(shadows).toContain(
			'persistedBake={usePersistedBake ? bakedShadow : undefined}'
		)
		expect(shadows).toContain('basis={bakeBasis}')
		expect(shadows).toMatch(
			/persisted\.basis\s*\?\s*\{\s*dataUrl: null,\s*signature: persisted\.signature,\s*basis: persisted\.basis\s*\}\s*:\s*\{ dataUrl: null, \.\.\.liveRef\.current \}/
		)
		expect(shadows).toContain('return { dataUrl, ...liveRef.current }')
	})
})
