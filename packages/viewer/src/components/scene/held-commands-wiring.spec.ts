/**
 * Every scene layer that runs commands sits behind a held executor, and the
 * camera layer takes commands only once it has framed the model.
 *
 * A source guard, for the reason `hotspot-camera-wiring.spec.ts` gives: these
 * layers mount inside the canvas, which this runner cannot render, and putting
 * a ref back in place of the slot type-checks and breaks nothing else here.
 * The behavior of the slot itself is `use-held-executor.spec.tsx`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const viewer = read('..', '..', 'vectreal-viewer.tsx')
const animation = read('..', '..', 'hooks', 'use-animation-runtime.ts')
const camera = read('scene-camera.tsx')

describe('viewer commands are held for the layer that runs them', () => {
	it('routes camera and hotspot commands through held slots', () => {
		expect(viewer).toContain('const cameraLayer = useHeldExecutor()')
		expect(viewer).toContain('const hotspotLayer = useHeldExecutor()')
		expect(viewer).toMatch(/case 'activate_camera':\s*cameraLayer\.execute/)
		expect(viewer).toMatch(/case 'focus_hotspot':\s*hotspotLayer\.execute/)
		expect(viewer).toContain('onCommandExecutorReady={cameraLayer.register}')
		expect(viewer).toContain('onCommandExecutorReady={hotspotLayer.register}')
	})

	it('routes animation commands through a held slot', () => {
		expect(animation).toContain('const runtime = useHeldExecutor()')
		expect(animation).toContain('forwardCommand: runtime.execute')
	})

	it('registers the camera layer only once it has framed the model', () => {
		const effect = camera.slice(
			camera.indexOf('if (!isFramed) return'),
			camera.indexOf("type: 'viewer_ready'")
		)
		expect(effect).toContain('onCommandExecutorReady?.({')
	})
})
