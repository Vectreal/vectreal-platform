/**
 * The composer exists before the first frame that could use it.
 *
 * A source guard, like `idle-convergence-wiring.spec.ts`: components need a
 * WebGL context this runner does not have. R3F subscribes `useFrame` in a
 * layout effect, so a pipeline built in a passive one leaves a frame drawn
 * straight to the canvas. three keys a program on its render target's output,
 * so that frame compiles every material once for the canvas and the next
 * frame compiles them all again for the composer, both on the main thread
 * while the loader is showing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const composer = readFileSync(
	join(import.meta.dirname, 'scene-postprocessing.tsx'),
	'utf8'
)

describe('the composer pipeline', () => {
	it('is built in a layout effect', () => {
		expect(composer).toMatch(
			/useLayoutEffect\(\(\) => \{\s*const pipeline = createPipeline\(/
		)
	})
})
