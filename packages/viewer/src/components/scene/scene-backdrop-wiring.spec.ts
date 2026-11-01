/**
 * The scene's stage is painted by the viewer, behind its canvas and under its
 * screenshots.
 *
 * A source guard rather than a behavioral test, like
 * `displayed-model-wiring.spec.ts`: this package's runner has no WebGL
 * context. The rule itself, which backdrop a scene gets, is tested where it
 * lives, in `@vctrl/core`'s `scene-backdrop.spec.ts`.
 *
 * Before the stage, nothing behind the transparent canvas belonged to the
 * viewer, so each surface showed its own page there and a shadow landed on
 * whatever that was.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const viewer = read('..', '..', 'vectreal-viewer.tsx')
const canvas = read('..', 'canvas-wrapper.tsx')
const sceneModel = read('scene-model.tsx')

describe('the scene backdrop', () => {
	it("is resolved from the scene's lighting, through the one rule", () => {
		// `resolveLighting` lets a stage through only as hex, and gives way to
		// the environment map while it is the background.
		expect(viewer).toContain('resolveLighting({ lighting })')
		expect(viewer).toContain(
			'resolveLighting({ environment: envOptions, shadows: shadowsOptions })'
		)
		expect(viewer).toMatch(
			/const backdrop =\s*background\.type === 'color' \|\| background\.type === 'gradient'\s*\? background\s*: null/
		)
	})

	it('is painted on the viewer container, behind the canvas', () => {
		expect(viewer).toMatch(
			/containerBackground=\{\s*backdrop \? sceneBackdropCss\(backdrop\) : undefined\s*\}/
		)
		expect(canvas).toMatch(
			/style=\{\s*containerBackground \? \{ background: containerBackground \} : undefined\s*\}/
		)
	})

	it('is painted under a screenshot before the canvas is drawn over it', () => {
		expect(viewer).toContain('backdrop={backdrop}')
		expect(sceneModel).toMatch(
			/buildScreenshotDataUrl\(\s*gl\.domElement,\s*options,\s*backdrop\s*\)/
		)
		const fill = sceneModel.indexOf(
			'context.fillRect(0, 0, options.width, options.height)'
		)
		const draw = sceneModel.indexOf('context.drawImage(')
		expect(fill).toBeGreaterThan(-1)
		expect(fill).toBeLessThan(draw)
	})
})
