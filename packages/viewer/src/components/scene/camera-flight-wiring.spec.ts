/**
 * The camera layer flies with `sampleCameraFlight`, once per frame, from raw
 * progress.
 *
 * A source guard, because `SceneCamera` needs a WebGL context this package's
 * runner does not have. The path itself is covered in `camera-flight.spec.ts`;
 * this keeps the frame loop on it. The flight it replaced rounded progress to
 * a fixed number of steps before sampling, which held the camera still on two
 * frames of three.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const camera = readFileSync(
	join(import.meta.dirname, 'scene-camera.tsx'),
	'utf8'
)

const frameLoopStart = camera.indexOf('useFrame(() => {')
const frameLoopEnd = camera.indexOf('isWaitingForStableFrame.current ||')
const frameLoop = camera.slice(frameLoopStart, frameLoopEnd)

describe('the camera flight frame loop', () => {
	it('is found where the guard looks for it', () => {
		expect(frameLoopStart).toBeGreaterThan(-1)
		expect(frameLoopEnd).toBeGreaterThan(frameLoopStart)
	})

	it('samples the flight at the raw progress of this frame', () => {
		expect(frameLoop).toContain('sampleCameraFlight(')
		expect(frameLoop).toMatch(
			/sampleCameraFlight\(\s*runtime\.flight,\s*rawProgress,/
		)
		expect(frameLoop).not.toContain('Math.round(')
	})

	it('aims the controls at the target the frame was oriented to', () => {
		expect(frameLoop).toContain(
			'activeCamera.quaternion.copy(frame.quaternion)'
		)
		expect(frameLoop).toContain('controls.target.copy(frame.target)')
	})

	it('hands Smart the model it has to fly around, read when the flight starts', () => {
		expect(camera).toMatch(
			/bounds: modelRef\.current\s*\?\s*worldBounds\(modelRef\.current\)\.getBoundingSphere\(new Sphere\(\)\)/
		)
		// A dependency on the model would re-register the executor on a swap.
		const start = camera.slice(
			camera.indexOf('const startTransition = useCallback('),
			camera.indexOf('const executeViewerCommand')
		)
		expect(start).toContain(
			'[applyCameraInstantly, controls?.target, invalidate, sceneCamera]'
		)
	})
})
