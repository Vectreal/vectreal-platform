/**
 * The viewer's name and keys are reached from the viewer.
 *
 * A source guard, like `scene-view-return-wiring.spec.ts`: this runner cannot
 * mount the canvas, and the rules in `viewer-keys.ts` keep their own passing
 * tests while the lines that call them are deleted. `viewer-e2e` presses the
 * keys in a real browser.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

const between = (start: string, end: string) => {
	const from = source.indexOf(start)
	return source.slice(from, source.indexOf(end, from))
}

describe('the viewer is named and takes keys', () => {
	it('hands its name and its key help to the container', () => {
		const canvas = between('<Canvas', 'overlay={')
		expect(canvas).toContain('label={label}')
		// `liveKeys` is `viewerKeys`, or none while the scene waits for a tap.
		expect(canvas).toContain('keyHelp={describeViewerKeys(liveKeys, language)}')
	})

	it('listens on the container, with the same keys it describes', () => {
		const keyboard = between('<SceneKeyboardControls', '/>')
		expect(keyboard).toContain('container={container}')
		expect(keyboard).toContain('keys={liveKeys}')
		expect(keyboard).toContain('onHome={returnHome}')
	})

	it('reads the keys from the flags the controls obey, overrides included', () => {
		const keys = between('const viewerKeys', '\n\t)\n')
		expect(keys).toContain(
			'controlsOptions?.enabled ?? controlsEnabledOverride ?? undefined'
		)
		expect(keys).toContain('controlsOptionsOverride?.zoom')
		expect(keys).toContain('controlsOptionsOverride?.pan')
		expect(keys).toContain('canReturnHome: activeCameraId !== null')
	})

	it('sends Home back to the camera in use', () => {
		const home = between('const returnHome', '\n\t}, [')
		expect(home).toMatch(/activateCamera\(activeCameraId\)/)
	})
})
