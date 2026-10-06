/**
 * A camera command flies with the transition in effect when it runs.
 *
 * A source guard, because `SceneCamera` needs a WebGL context this package's
 * runner does not have.
 *
 * The command executor read `sceneTransition` through its closure while its
 * dependencies left it out, so the registered executor kept the transition it
 * was created with: an embed host calling `setTransition({ type: 'none' })`
 * and then `activateCamera` still got the old flight.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, 'scene-camera.tsx'),
	'utf8'
)

const executor = source.slice(
	source.indexOf('const executeViewerCommand = useCallback('),
	source.indexOf('useEffect(', source.indexOf('const executeViewerCommand'))
)

describe('camera commands read the current transition', () => {
	it('resolves the selection from the latest transition', () => {
		expect(executor).toContain('sceneTransitionRef.current,')
		expect(executor).not.toMatch(/\bsceneTransition,/)
	})

	it('keeps the ref on the transition of the latest render', () => {
		expect(source).toContain('sceneTransitionRef.current = sceneTransition\n')
	})
})
