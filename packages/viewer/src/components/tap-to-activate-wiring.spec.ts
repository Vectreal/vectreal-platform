/**
 * A scene that waits for a tap holds every input until the button is pressed,
 * keeps auto-rotate turning, and gives way to a host that sets the controls.
 *
 * A source guard, like `interaction-hint-wiring.spec.ts`: this runner cannot
 * mount the viewer, so the lines that connect the pieces are read here, and
 * the viewer e2e drives both modes in a browser.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('tap to activate is wired into the viewer', () => {
	it('starts immediately unless a surface asks for a tap', () => {
		expect(source).toContain("interactionStart = 'immediate',")
	})

	it('waits only where something moves, and not once a host sets the controls', () => {
		expect(source).toMatch(
			/const waitsForTap =\s*interactionStart === 'tap' &&\s*controlsEnabledOverride === null &&\s*\(viewerKeys\.rotate \|\| viewerKeys\.zoom \|\| viewerKeys\.pan\)/
		)
		expect(source).toContain('const inputLocked = waitsForTap && !tapStarted')
	})

	it('locks the pointer, the keys and double-click focus until started', () => {
		expect(source).toContain('inputLocked={inputLocked}')
		expect(source).toContain('keys={liveKeys}')
		// Not announced as operable until then, so the button is what is reached.
		expect(source).toContain('keyHelp={describeViewerKeys(liveKeys, messages)}')
		expect(source).toMatch(
			/setTapStarted\(false\)\s*transitionOverride\.current = null/
		)
		expect(source).toMatch(
			/focusOnDoubleClick === true &&\s*shownModel &&\s*!inputLocked/
		)
	})

	it('shows the start button while locked, and the way back once started', () => {
		expect(source).toMatch(/tapToActivate=\{\s*tapWords && inputLocked \?/)
		expect(source).toMatch(/tapToDeactivate=\{\s*tapWords && !inputLocked \?/)
	})
})
