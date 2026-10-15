/**
 * The viewer compiles a model's shaders before it draws or reveals it.
 *
 * A source guard, like `idle-convergence-wiring.spec.ts`: components need a
 * WebGL context this runner does not have. `shader-warmup.spec.ts` proves the
 * warm-up compiles for the target it is given; this proves it is given the
 * composer's buffer, that the frame loop waits for it, and that the loader
 * does too. Any one unwired puts the compile back on the main thread, behind
 * a loader whose spinner then stops.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const composer = readFileSync(
	join(import.meta.dirname, 'scene-postprocessing.tsx'),
	'utf8'
)
const viewer = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('shader warm-up', () => {
	it('compiles for the buffer the composer draws the scene into', () => {
		expect(composer).toMatch(
			/warmUpScene\(\s*gl,\s*scene,\s*camera,\s*current\.pipeline\.composer\.inputBuffer,\s*\(\) => cancelled\s*\)/
		)
	})

	it('runs again for every model', () => {
		expect(composer).toMatch(
			/warmed\.current = \{ model \}[\s\S]*?\}, \[model,/
		)
	})

	it('holds the frame loop until the model on screen is warmed', () => {
		const frame = composer.slice(composer.indexOf('useFrame((state, delta)'))
		const gate = frame.match(
			/if \(!warmed\.current \|\| warmed\.current\.model !== modelRef\.current\) \{[^}]*\}\s*return\s*\}/
		)
		expect(gate?.index).toBeGreaterThan(-1)
		expect(gate!.index!).toBeLessThan(
			frame.indexOf('pipeline.render(delta, plan,')
		)
	})

	it('keeps the history wherever it is redrawn under another renderer', () => {
		expect(composer).toContain(
			'pipeline.render(delta, plan, state.internal.priority > 1)'
		)
		expect(composer).toContain('accumulatePass.present(keepHistory)')
	})

	it('reports the warm-up done once the model is marked warmed', () => {
		expect(composer).toMatch(
			/\.then\(\(\) => \{\s*if \(cancelled\) return\s*warmed\.current = \{ model \}\s*onShadersReadyRef\.current\?\.\(\)/
		)
		expect(composer).toContain('onShadersReadyRef.current = onShadersReady')
		expect(composer).toMatch(
			/<ViewerComposer[\s\S]*?onShadersReady=\{onShadersReady\}[\s\S]*?\/>/
		)
	})

	it('holds the loader until the first warm-up finishes', () => {
		expect(viewer).toContain('onShadersReady={handleShadersReady}')
		expect(viewer).toContain(
			'isInitialFramingComplete && (areShadersReady || !enablePostProcessing)'
		)
	})
})
