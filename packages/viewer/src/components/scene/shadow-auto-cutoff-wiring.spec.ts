/**
 * The cutoff calibrator decides by `cutoffCalibrationStep` and remembers what
 * it wrote.
 *
 * A source guard, like `shadow-bake-measure-wiring.spec.ts`: the component
 * needs a WebGL context this runner does not have.
 * `shadow-cutoff-calibration.spec.ts` proves the rule; this proves the
 * component feeds it the material's live value and the one it last wrote. A
 * static bake (drei `temporal={false}`) re-bakes without advancing a counter,
 * so without this the shadow kept the uncalibrated cutoff after its first
 * re-bake.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const cutoff = readFileSync(
	join(import.meta.dirname, 'shadow-auto-cutoff.tsx'),
	'utf8'
)

describe('the shadow cutoff calibrator', () => {
	it('asks the rule with the live alphaTest and the value it last wrote', () => {
		expect(cutoff).toMatch(
			/cutoffCalibrationStep\(\{[\s\S]*?alphaTest: mesh\.material\.alphaTest,\s*lastWritten: lastWrittenRef\.current\s*\}\)/
		)
	})

	it('forgets its value while a bake accumulates, and acts only on calibrate', () => {
		expect(cutoff).toMatch(
			/if \(step === 'baking'\) lastWrittenRef\.current = null\s*if \(step !== 'calibrate'\) return/
		)
	})

	it('remembers the value it writes', () => {
		expect(cutoff).toMatch(
			/mesh\.material\.alphaTest = alphaTest\s*lastWrittenRef\.current = alphaTest/
		)
	})

	it('recalibrates when the trim or the bake mode changes', () => {
		expect(cutoff).toMatch(
			/useEffect\(\(\) => \{\s*lastWrittenRef\.current = null\s*\}, \[cutoffScale, temporal\]\)/
		)
	})
})
