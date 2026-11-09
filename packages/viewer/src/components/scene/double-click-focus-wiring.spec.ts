/**
 * Double-click to focus is reached from the viewer, only where the scene's
 * controls ask for it, and flies through the camera layer's own flight.
 *
 * A source guard, like `scene-view-return-wiring.spec.ts`: this runner cannot
 * mount the canvas, and `scene-double-click-focus.spec.tsx` keeps passing
 * while the lines that use it are deleted. `viewer-e2e` double-clicks for real.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')
const viewer = read('..', '..', 'vectreal-viewer.tsx')
const camera = read('scene-camera.tsx')

describe('double-click to focus is wired into the viewer', () => {
	it('listens only where the scene turned it on, and reads absent as off', () => {
		expect(viewer).toMatch(
			/controlsOptions\?\.focusOnDoubleClick === true && shownModel && \(\s*<SceneDoubleClickFocus\s*model=\{shownModel\}/
		)
		expect(viewer).toContain('const shownModel = displayedModel ?? model')
	})

	it('focuses through the camera layer, and frames again as Home does', () => {
		const focus = viewer.slice(viewer.indexOf('<SceneDoubleClickFocus'))
		expect(focus).toMatch(
			/onFocus=\{focusOnPoint\}\s*onBackground=\{returnHome\}/
		)
		expect(viewer).toContain('focusRequest={focusRequest}')
	})

	it('flies with the flight runner, and jumps under reduced motion', () => {
		const filler = camera.slice(
			camera.indexOf('focusRequest.current = (point)'),
			camera.indexOf('focusRequest.current = null')
		)
		expect(filler).toContain('if (prefersReducedMotion())')
		expect(filler).toContain('flight.start(')
		expect(filler).toContain('framing.current?.fly(null, progress)')
	})
})
