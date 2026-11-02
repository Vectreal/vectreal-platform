/**
 * A surface that only shows scenes draws the contact shadow where a live
 * bake would exceed its budget.
 *
 * A source guard, like `shadow-bake-measure-wiring.spec.ts`: the component
 * needs a WebGL context this runner does not have. The rule itself is
 * `live-bake-budget.spec.ts`; this checks it is reached.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const shadows = readFileSync(
	join(import.meta.dirname, 'scene-shadows.tsx'),
	'utf8'
)
const viewer = readFileSync(
	join(import.meta.dirname, '../../vectreal-viewer.tsx'),
	'utf8'
)

describe('the live bake gate', () => {
	it('draws the contact shadow, not the bake, when the gate says skip', () => {
		expect(shadows).toMatch(
			/\) : skipReason \? \(\s*contactShadow\(1\)\s*\) : sized \? \([\s\S]*?\bbake\s*\) : null\}/
		)
	})

	it('draws that contact shadow once, not every frame', () => {
		// The animating model's contact shadow re-renders the model each frame;
		// a still one needs one render, and the viewer can then go idle.
		expect(shadows).toContain('frames={frames}')
		expect(shadows).toContain('return contactShadow(Infinity)')
	})

	it('asks only where no stored bake is shown, once the model is sized', () => {
		expect(shadows).toMatch(
			/const skipReason =\s*showsPersistedBake \|\| !sized\s*\? null\s*: liveBakeSkipReason\(\{ mode: liveBake, coarsePointer, estimatedDraws \}\)/
		)
	})

	it('keeps an older-format bake only on a surface that never saves one', () => {
		// The publisher saves bakes; there a lighting change must re-bake.
		expect(shadows).toContain('const acceptOlderFormat = !onShadowBakeReady')
		expect(shadows).toMatch(
			/isPersistedBakeValid\(\s*bakedShadow,\s*bakeOptions,\s*\{ \.\.\.bakeBasis, measured \},\s*\{ acceptOlderFormat \}\s*\)/
		)
	})

	it('is handed the surface’s choice and reports what it skipped', () => {
		expect(viewer).toContain('liveBake={liveShadowBake}')
		expect(viewer).toContain('onLiveBakeSkipped={handleLiveBakeSkipped}')
		expect(viewer).toContain("type: 'shadow_bake_skipped'")
	})
})
