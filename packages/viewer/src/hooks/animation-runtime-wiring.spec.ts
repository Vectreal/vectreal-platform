/**
 * The viewer hands its host's choices to the animation runtime.
 *
 * A source guard rather than a behavioral test, like
 * `displayed-model-wiring.spec.ts`: this package's runner has no WebGL context.
 * `use-animation-runtime.spec.tsx` covers what the runtime does with them;
 * this covers that the root actually passes them. A host that draws its own
 * playback controls needs both: a way to turn the built-in ones off, and the
 * status events, including the reset when the runtime goes away.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const viewer = readFileSync(
	join(import.meta.dirname, '..', 'vectreal-viewer.tsx'),
	'utf8'
)
const sceneAnimation = readFileSync(
	join(import.meta.dirname, '..', 'components', 'scene', 'scene-animation.tsx'),
	'utf8'
)
const runtimeCall = viewer.slice(
	viewer.indexOf('useAnimationRuntime({'),
	viewer.indexOf('})', viewer.indexOf('useAnimationRuntime({'))
)

describe('the animation runtime call', () => {
	it("passes the host's say over the built-in controls", () => {
		expect(runtimeCall).toMatch(/allowControls: showAnimationControls/)
	})

	it("passes the host's event handler, so status changes reach it", () => {
		expect(runtimeCall).toMatch(/\bonInteractionEvent\b/)
	})
})

describe('the mixer component across a model swap', () => {
	it('resets the status it last reported along with the playback state', () => {
		expect(sceneAnimation).toMatch(
			/stateRef\.current = initialPlaybackState\(\)\s*(\/\/.*\s*)*statusRef\.current = readStatus\(stateRef\.current\)/
		)
	})

	it('reports where playback is each time it registers its executor', () => {
		expect(sceneAnimation).toMatch(
			/onCommandExecutorReady\?\.\(\{ execute: executeViewerCommand \}\)\s*(\/\/.*\s*)*onPlaybackStatusChangeRef\.current\?\.\(statusRef\.current\)/
		)
	})
})
