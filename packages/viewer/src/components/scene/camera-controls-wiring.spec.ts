/**
 * The camera switcher is reached from the viewer.
 *
 * A source guard, like `scene-view-return-wiring.spec.ts`: this runner cannot
 * mount the canvas, and `camera-controls-rule.spec.ts` and
 * `camera-controls.spec.tsx` keep passing while the lines that call them are
 * deleted. This pins those lines in the suite that runs on every change.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

const between = (start: string, end: string) => {
	const from = source.indexOf(start)
	return source.slice(from, source.indexOf(end, from))
}

describe('the camera switcher is wired into the viewer', () => {
	it('is on unless a host turns it off', () => {
		expect(source).toContain('showCameraControls = true,')
	})

	it('asks the rule with the host, the author and the scene views', () => {
		const rule = between('shouldShowCameraControls({', '})')
		expect(rule).toContain('sceneViewCount: sceneViewCameras.length')
		expect(rule).toContain('authorAllows: cameraOptions?.showControls')
		expect(rule).toContain('hostAllows: showCameraControls')
	})

	it('steps through scene cameras only, by the rule the way back uses', () => {
		expect(source).toMatch(
			/const sceneViewCameras = useMemo\(\s*\(\) => resolveSceneViewCameras\(cameraOptions\?\.cameras, hotspots/
		)
	})

	it('hands the control to the overlay behind the rule, selecting through the command path', () => {
		const slot = between('cameraControls={', 'sceneViewReturn={')
		expect(slot).toMatch(/showCameraSwitcher \? \(\s*<CameraControls/)
		expect(slot).toContain('cameras={sceneViewCameras}')
		expect(slot).toContain('activeCameraId={activeCameraId}')
		expect(slot).toContain('onSelect={activateCamera}')
		// Named from every stored hotspot, not only the drawn markers.
		expect(slot).toMatch(
			/offListLabel=\{resolveHotspotViewName\(\s*activeCameraId,\s*hotspots \?\? \[\]/
		)
	})
})
