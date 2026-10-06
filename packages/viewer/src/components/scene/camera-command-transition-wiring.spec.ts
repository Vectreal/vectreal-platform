/**
 * A camera command flies with the transition in effect when it runs.
 *
 * A source guard, because `SceneCamera` needs a WebGL context this package's
 * runner does not have.
 *
 * Two ways it went stale. The command executor read `sceneTransition` through
 * its closure while its dependencies left it out, so it kept the transition it
 * was created with. And `set_transition` only set viewer state, which reaches
 * the camera on the next render: an embed host calling `setTransition` and
 * then `activateCamera` back to back sends two messages that both run before
 * that render, so the flight still used the old transition.
 *
 * The override stays with the viewer, not the camera layer: the canvas
 * unmounts while the viewer is out of view, and a held `set_transition` would
 * replay after a camera command sent before it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const camera = readFileSync(
	join(import.meta.dirname, 'scene-camera.tsx'),
	'utf8'
)
const viewer = readFileSync(
	join(import.meta.dirname, '../../vectreal-viewer.tsx'),
	'utf8'
)

const slice = (source: string, start: string, end: string) =>
	source.slice(
		source.indexOf(start),
		source.indexOf(end, source.indexOf(start))
	)

const executor = slice(
	camera,
	'const executeViewerCommand = useCallback(',
	'useEffect('
)

describe('set_transition is in effect before the next command', () => {
	it('is written to a viewer-owned ref the moment it runs', () => {
		const handler = slice(viewer, "case 'set_transition':", 'break')
		expect(handler).toContain('transitionOverride.current = {')
		expect(viewer).toContain('const transitionOverride = useRef<')
		expect(viewer).not.toContain('setTransitionOverride')
	})

	it('is handed to the camera as the ref, not a value', () => {
		expect(viewer).toContain('transitionOverride={transitionOverride}')
		expect(viewer).not.toMatch(/sceneTransition=\{/)
	})
})

describe('camera flights read the current transition', () => {
	it('resolves a command from the override, then the latest prop', () => {
		expect(executor).toContain(
			'transitionOverride?.current ?? sceneTransitionRef.current,'
		)
		expect(executor).not.toMatch(/\bsceneTransition,/)
	})

	it('resolves a prop-driven flight from the override too', () => {
		const effect = slice(
			camera,
			'// update camera properties if props change after initialization',
			'const selectionKey'
		)
		expect(effect).toContain('transitionOverride?.current ?? sceneTransition,')
	})

	it('keeps the ref on the transition of every render', () => {
		// At the top level of the component, not inside an effect or a branch.
		expect(camera).toContain(
			'\tconst sceneTransitionRef = useRef(sceneTransition)\n\tsceneTransitionRef.current = sceneTransition\n'
		)
	})
})
