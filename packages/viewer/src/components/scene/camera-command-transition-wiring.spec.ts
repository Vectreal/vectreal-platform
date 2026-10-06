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

describe('set_transition reaches the camera before the next command', () => {
	it('is routed to the camera layer, in order with activate_camera', () => {
		const routing = slice(viewer, "case 'activate_camera':", 'break')
		expect(routing).toContain("case 'set_transition':")
		expect(routing).toContain('cameraLayer.execute(command)')
		expect(viewer).not.toContain('setTransitionOverride')
	})

	it('is recorded the moment the command runs', () => {
		const recorded = slice(
			executor,
			"if (command.type === 'set_transition') {",
			"if (command.type !== 'activate_camera')"
		)
		expect(recorded).toContain('transitionOverride.current = {')
		expect(recorded).toContain('return')
	})
})

describe('camera commands read the current transition', () => {
	it('resolves the selection from the override, then the latest prop', () => {
		expect(executor).toContain(
			'transitionOverride.current ?? sceneTransitionRef.current,'
		)
		expect(executor).not.toMatch(/\bsceneTransition,/)
	})

	it('keeps the ref on the transition of every render', () => {
		// At the top level of the component, not inside an effect or a branch.
		expect(camera).toContain(
			'\tconst sceneTransitionRef = useRef(sceneTransition)\n\tsceneTransitionRef.current = sceneTransition\n'
		)
	})

	it('applies the override to a selection the props make too', () => {
		expect(
			camera.match(/transitionOverride\.current \?\? sceneTransition\b/g)
		).toHaveLength(3)
	})
})
