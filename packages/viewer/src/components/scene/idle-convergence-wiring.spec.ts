/**
 * The composer feeds `render-activity` every signal that can make a still
 * frame stale.
 *
 * A source guard rather than a behavioural test, for the same reason as
 * `center-cache-key-wiring.spec.ts`: this package's runner loads `.ts` only,
 * because components need a WebGL context. `render-activity.spec.ts` proves
 * each signal restarts the accumulation; this proves each one is connected.
 * A signal left unwired fails silently: the viewer keeps showing a converged
 * frame of a scene that has since changed.
 *
 * Renaming a local is meant to fail it - re-point the guard rather than
 * deleting it.
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

describe('idle convergence is told about every change', () => {
	it("treats anyone's invalidate() as activity", () => {
		expect(composer).toContain('invalidated: state.internal.frames > 0')
	})

	it('fingerprints the scene after bringing its matrices up to date', () => {
		const frame = composer.slice(composer.indexOf('useFrame((state, delta)'))
		expect(frame.indexOf('state.scene.updateMatrixWorld()')).toBeGreaterThan(-1)
		expect(frame.indexOf('state.scene.updateMatrixWorld()')).toBeLessThan(
			frame.indexOf('computeSceneSignature(state.scene)')
		)
	})

	it('holds the viewer in motion while an animation plays', () => {
		expect(composer).toContain('active: activeRef.current')
		expect(viewer).toContain('active={animation.status.active}')
	})

	it('restarts on every render of the viewer', () => {
		expect(composer).toMatch(/useEffect\(\(\) => \{\s*invalidate\(\)\s*\}\)/)
	})
})

describe('AO held for rest runs only while the viewer is at rest', () => {
	it('enables the AO pass on accumulate frames only when held for rest', () => {
		expect(composer).toContain(
			'if (aoPass) aoPass.enabled = !aoAtRest || jittering'
		)
		expect(composer).toContain("jittering = plan.kind === 'accumulate'")
	})

	it('reaches the composer from the shadow settings', () => {
		expect(viewer).toContain('aoAtRest={shadowsOptions?.aoAtRest}')
	})
})

describe('N8AO sees a still camera while the scene render is jittered', () => {
	it('restores the camera before the AO pass is added', () => {
		expect(composer.indexOf('camera.clearViewOffset()')).toBeGreaterThan(-1)
		expect(composer.indexOf('camera.clearViewOffset()')).toBeLessThan(
			composer.indexOf('composer.addPass(aoPass)')
		)
	})
})
