/**
 * An optimization pass must not move the camera.
 *
 * A source guard rather than a behavioral test, like
 * `center-cache-key-wiring.spec.ts`: this package's runner has no WebGL
 * context. `model-frame.spec.ts` covers the rule; this pins that both places
 * that react to a model change actually go through it.
 *
 * `SceneModel` refit the camera whenever its `object` prop changed, and an
 * optimization pass always hands it a new object, so every pass snapped the
 * view back to its opening framing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, ...path), 'utf8')

const sceneModel = read('scene-model.tsx')
const viewer = read('..', '..', 'vectreal-viewer.tsx')

describe('a new rendition of the same model keeps the view', () => {
	it('refits on a new frame, never on a new object', () => {
		const refit = sceneModel.slice(
			sceneModel.indexOf('const mountedRef = useRef(false)'),
			sceneModel.indexOf('onScreenshotCaptureReady?.(captureScreenshot)')
		)

		expect(refit).toContain('bounds.refresh(objectRef.current).fit()')
		expect(refit).toContain('[bounds, normalizationOptions?.enabled, frame]')
	})

	it('measures the scale from the same frame as the centering', () => {
		expect(sceneModel).toContain('useModelFrame(object, modelKey)')
		expect(sceneModel).toContain('frame?.rawDiagonal')
	})

	it('hands the caller key to SceneModel', () => {
		expect(viewer).toContain('modelKey={modelKey}')
	})
})
