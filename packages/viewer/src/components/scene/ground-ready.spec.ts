/**
 * The viewer's first visible frame waits for the ground's shadow.
 *
 * The decision is tested as data; the wiring is a source guard, like
 * `composer-first-frame-wiring.spec.ts`, because the components need a WebGL
 * context this runner does not have. Before this, the loader left as soon as
 * the camera was framed and the shaders compiled, and the shadow arrived a
 * moment later in every mode: a stored bake's image, a live bake's frames, a
 * contact shadow's first capture.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	type GroundDrawing,
	type GroundRun,
	isGroundReady,
	resolveGroundDrawing
} from './scene-shadows'

const read = (path: string) =>
	readFileSync(join(import.meta.dirname, path), 'utf8')

const base = {
	enabled: true,
	animating: false,
	storedUrl: null,
	skipped: false,
	sized: true
}

describe('resolveGroundDrawing', () => {
	it('has nothing to draw with the ground off', () => {
		expect(
			resolveGroundDrawing({ ...base, enabled: false, sized: false })
		).toBe('none')
	})

	it('chooses nothing before the model is measured', () => {
		expect(resolveGroundDrawing({ ...base, sized: false })).toBeNull()
	})

	it('names a stored bake by its image', () => {
		expect(resolveGroundDrawing({ ...base, storedUrl: 'a.png' })).toBe(
			'stored:a.png'
		)
	})

	it('draws the contact shadow while animating, and for a skipped bake', () => {
		expect(
			resolveGroundDrawing({ ...base, animating: true, storedUrl: 'a.png' })
		).toBe('contact')
		expect(resolveGroundDrawing({ ...base, skipped: true })).toBe('contact')
	})

	it('bakes live otherwise', () => {
		expect(resolveGroundDrawing(base)).toBe('live')
	})
})

describe('isGroundReady', () => {
	const run = (drawing: GroundDrawing | null): GroundRun => ({ drawing })

	it('is ready with nothing to draw', () => {
		expect(isGroundReady(run('none'), null)).toBe(true)
	})

	it('waits while no drawing is chosen', () => {
		const current = run(null)
		expect(isGroundReady(current, current)).toBe(false)
	})

	it('waits until the current run reports itself drawn', () => {
		const current = run('live')
		expect(isGroundReady(current, null)).toBe(false)
		expect(isGroundReady(current, current)).toBe(true)
	})

	// A stored image that fails gives way to a live bake, and a bake restarted
	// by new inputs (or a new model) starts from nothing: an earlier report,
	// even one for the same kind of drawing, says nothing about this run.
	it('does not count a report from an earlier run', () => {
		expect(isGroundReady(run('live'), run('stored:a.png'))).toBe(false)
		expect(isGroundReady(run('live'), run('live'))).toBe(false)
		expect(isGroundReady(run('contact'), run('contact'))).toBe(false)
	})
})

describe('the ground shadow holds the first frame', () => {
	const viewer = read('../../vectreal-viewer.tsx')
	const shadows = read('scene-shadows.tsx')

	it('holds the reveal through the loading hook', () => {
		expect(viewer).toMatch(
			/useViewerLoading\(\s*hasContent,[\s\S]{0,140}?,\s*!isGroundReady\s*\)/
		)
		expect(viewer).toMatch(/onGroundReadyChange=\{handleGroundReadyChange\}/)
		expect(viewer).toMatch(
			/const handleGroundReadyChange = useCallback\(\(ready: boolean\) => \{\s*setIsGroundReady\(ready\)/
		)
	})

	it('is reset with the content, like the shaders', () => {
		const reset = viewer.slice(
			viewer.indexOf('if (!hasContent) {'),
			viewer.indexOf('}, [hasContent])')
		)
		expect(reset).toContain('setIsGroundReady(false)')
	})

	it('reports every change of readiness, the first one included', () => {
		expect(shadows).toMatch(
			/useLayoutEffect\(\(\) => \{\s*onGroundReadyChangeRef\.current\?\.\(groundReady\)\s*\}, \[groundReady\]\)/
		)
		expect(shadows).toMatch(
			/const groundReady = isGroundReady\(run, reported\)/
		)
	})

	// Every start-over of the drawing is a new run, so no earlier report
	// stands in for it; each report names the run current when it is made.
	it('starts a new run whenever the drawing starts over', () => {
		expect(shadows).toMatch(
			/\[groundDrawing, liveBakeRun, isModelAnimating, shadowGeneration\]/
		)
		// The bake's identity starts a run only while the bake is what draws:
		// the contact shadow and the stored plane do not restart on it.
		expect(shadows).toContain(
			"const liveBakeRun = groundDrawing === 'live' ? bake : null"
		)
		expect(shadows).toContain('runRef.current = run')
		expect(shadows).toMatch(
			/const markDrawn = useCallback\(\(\) => setReported\(runRef\.current\), \[\]\)/
		)
	})

	// The mounted drawing is chosen by the same value the readiness reads, so
	// the viewer never waits on a report nothing mounted can send.
	it('mounts the drawing it waits for', () => {
		const render = shadows.slice(
			shadows.indexOf("if (groundDrawing === 'none') return null")
		)
		expect(render).toContain("groundDrawing === 'contact' ? (")
		expect(render).toContain("groundDrawing === 'live' ? (")
		expect(render).toContain('storedUrl !== null && bakedShadow ? (')
	})

	it('hears from every drawing', () => {
		expect(shadows).toMatch(/onSettled=\{markDrawn\}/)
		expect(shadows).toMatch(/onDrawn=\{markDrawn\}/)
		expect(shadows).toMatch(/<AfterFirstFrame onDrawn=\{markDrawn\} \/>/)
		expect(read('accumulative-shadow-bake.tsx')).toMatch(
			/state\.settled = true[\s\S]{0,80}current\.onSettled\?\.\(\)/
		)
		expect(read('scene-baked-shadow.tsx')).toMatch(
			/useTexture\(url\)[\s\S]*useLayoutEffect\(\(\) => onDrawn\?\.\(\), \[onDrawn\]\)/
		)
	})
})
