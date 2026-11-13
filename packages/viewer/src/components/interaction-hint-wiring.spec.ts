/**
 * The first-time hint is reached from the viewer, off unless a surface turns
 * it on, worded from the same keys the viewer announces, and withdrawn by a
 * host's `set_interaction_hint`.
 *
 * A source guard, like `scene-view-return-wiring.spec.ts`: this runner cannot
 * mount the viewer, and the hook's and wording's own specs keep passing while
 * the lines that use them are deleted.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('the interaction hint is wired into the viewer', () => {
	it('is off unless a surface turns it on', () => {
		expect(source).toContain('showInteractionHint = false,')
	})

	it('waits for the scene and its tap, and lets a host command decide over the prop', () => {
		const hook = source.slice(source.indexOf('useInteractionHint({'))
		expect(hook).toMatch(
			/enabled: interactionHintOverride \?\? showInteractionHint,[^]*?ready: loadingState === 'ready' && !inputLocked,\s*container/
		)
		expect(source).toMatch(
			/case 'set_interaction_hint':\s*setInteractionHintOverride\(command\.enabled\)/
		)
	})

	it('words it from the keys the viewer takes', () => {
		expect(source).toMatch(
			/describeInteraction\(\s*viewerKeys,\s*interactionHint\.input\s*\)/
		)
	})

	it('hands it to the overlay only while it is visible and has something to say', () => {
		expect(source).toMatch(
			/interactionHint=\{\s*interactionHint\.visible && interactionHintText \? \(\s*<InteractionHint text=\{interactionHintText\} \/>/
		)
	})
})
