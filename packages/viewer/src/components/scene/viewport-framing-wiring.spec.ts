/**
 * The viewport fit is wired into the camera layer and kept out of captures.
 *
 * A source guard, because `SceneCamera` needs a WebGL context this package's
 * runner does not have, and dropping any of these calls type-checks cleanly:
 * core's `viewport-framing.spec.ts` keeps passing while a phone crops the
 * subject again, or a thumbnail shrinks.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) =>
	readFileSync(join(import.meta.dirname, path), 'utf8')

const camera = read('scene-camera.tsx')
const flight = read('use-camera-flight.ts')
const model = read('scene-model.tsx')
const viewer = read('../../vectreal-viewer.tsx')

const slice = (source: string, start: string, end: string) =>
	source.slice(
		source.indexOf(start),
		source.indexOf(end, source.indexOf(start))
	)

describe('the camera layer fits what it shows', () => {
	it('resolves every selection for the live viewport, perspective cameras only', () => {
		const resolve = slice(
			camera,
			'export function resolveCameraSelection(',
			'export const SceneCamera'
		)
		expect(resolve).toContain('viewportAspect: viewportAspectOf(sceneCamera)')
	})

	it('starts each framing at the live aspect, before the first pose is shown', () => {
		const init = slice(
			camera,
			'const initializeCamera = useCallback(',
			'applyCameraInstantly(selection)'
		)
		expect(init).toContain(
			'framing.current = new CameraFraming(viewportAspectOf(sceneCamera) ?? 1)'
		)
	})

	it('resets the fit before a bounds fit, so update() clamps it to the host’s own limits', () => {
		const init = slice(
			camera,
			'const initializeCamera = useCallback(',
			'if (!hasInitialFramingCompleted.current)'
		)
		const reset = init.indexOf(
			'framing.current.reset(viewportAspectOf(sceneCamera) ?? 1)'
		)
		expect(reset).toBeGreaterThan(
			init.indexOf('applyCameraInstantly(selection)')
		)
		expect(init.indexOf('syncDistanceLimits()', reset)).toBeLessThan(
			init.indexOf('applyInitialFraming(')
		)
	})

	it('records the fit of a pose shown at once, before update() clamps it', () => {
		const instant = slice(
			camera,
			'const applyCameraInstantly = useCallback(',
			'const startTransition'
		)
		expect(instant).toContain(
			'framing.current?.show(selection.framing, progress)'
		)
		// The pose shown now wins over a flight still playing, read before it stops.
		expect(instant).toContain('const progress = flight.progress()')
		expect(instant.indexOf('flight.progress()')).toBeLessThan(
			instant.indexOf('flight.stop()')
		)
		expect(instant.indexOf('flight.stop()')).toBeGreaterThan(-1)
		expect(instant.indexOf('flight.stop()')).toBeLessThan(
			instant.indexOf('framing.current?.show(')
		)
		expect(instant.indexOf('syncDistanceLimits()')).toBeGreaterThan(-1)
		expect(instant.indexOf('syncDistanceLimits()')).toBeLessThan(
			instant.indexOf('controls.update?.()')
		)
	})

	it('carries an interrupted flight’s progress into the next one', () => {
		const start = slice(
			camera,
			'const startTransition = useCallback(',
			'const executeViewerCommand'
		)
		expect(start).toContain(
			'framing.current?.fly(selection.framing, flight.progress())'
		)
		expect(start.indexOf('flight.progress()')).toBeLessThan(
			start.indexOf('flight.start(')
		)
	})

	it('reports the progress of the pose the camera holds, not the clock’s', () => {
		expect(flight).toMatch(
			/const progress = useCallback\(\(\) => \{\s*return runtimeRef\.current\?\.shown \?\? null\s*\}/
		)
		const frame = slice(flight, 'useFrame(() => {', 'invalidate()\n\t})')
		expect(frame).toContain(
			'runtime.shown = easeFlightProgress(rawProgress, runtime.flight.easing)'
		)
		expect(frame.indexOf('runtime.shown =')).toBeGreaterThan(
			frame.indexOf('activeCamera.position.copy(frame.position)')
		)
	})

	it('resets the fit before SceneModel’s refit frames the model for this viewport', () => {
		const reset = slice(
			camera,
			'framingReset.current = () => {',
			'return () => {'
		)
		expect(reset).toContain(
			'framing.current?.reset(viewportAspectOf(sceneCamera) ?? 1)'
		)
		expect(reset).toContain('syncDistanceLimits()')
		const refit = slice(
			model,
			'framingReset?.current?.()',
			'bounds.refresh(objectRef.current).fit()'
		)
		expect(refit).toContain('framingReset?.current?.()')
		for (const layer of ['<SceneCamera', '<SceneModel']) {
			const start = viewer.indexOf(layer)
			expect(viewer.slice(start, viewer.indexOf('/>', start))).toContain(
				'framingReset={resetCameraFraming}'
			)
		}
	})

	it('hands the view to the destination when a flight lands', () => {
		expect(camera).toMatch(
			/useCameraFlight\(modelRef, \(\) => \{\s*framing\.current\?\.land\(\)\s*syncDistanceLimits\(\)/
		)
		const landing = slice(flight, 'if (rawProgress >= 1) {', 'invalidate()')
		expect(landing).toContain('onLandRef.current?.()')
	})

	it('refits the view, or both flight ends, on resize', () => {
		const resize = slice(
			camera,
			'const aspect = viewportAspectOf(sceneCamera)',
			'useFrame('
		)
		expect(resize).toMatch(
			/framing\.current\.refit\(\s*aspect,\s*\{ position: sceneCamera\.position, target \},\s*flight\.ends\(\)\s*\)/
		)
		expect(resize).toContain('size.width')
		expect(resize).toContain('size.height')
	})

	it('re-syncs the limits whenever the controls are recreated, fit moved or not', () => {
		const resync = slice(
			camera,
			'// The controls were recreated',
			'useEffect(() => {\n\t\tconst aspect'
		)
		expect(resync).toMatch(
			/useEffect\(\(\) => \{\s*syncDistanceLimits\(\)\s*\}, \[\s*controls,/
		)
	})

	it('stores what is on screen without its fit, in snapshots and the opening pose', () => {
		const snapshot = slice(
			camera,
			'const captureCameraSnapshot =',
			'onCameraSnapshotCaptureReady?.(captureCameraSnapshot)'
		)
		expect(snapshot).toMatch(
			/framing\.current\?\.storedPose\(\s*activeCamera\.position,\s*controlsTarget,\s*activeCamera\.aspect,\s*flight\.progress\(\)\s*\)/
		)
		expect(snapshot).toContain('viewportAspect: activeCamera.aspect')
		expect(snapshot).toMatch(
			/position: \[stored\.position\.x, stored\.position\.y, stored\.position\.z\]/
		)
		expect(snapshot).toContain('framingAspect: stored.framingAspect')

		const opening = slice(
			camera,
			'const completeInitialFraming',
			"type: 'initial_framing_completed'"
		)
		expect(opening).toMatch(
			/framing\.current\.storedPose\(\s*cameraPosition,\s*target,\s*\(sceneCamera as PerspectiveCamera\)\.aspect\s*\)/
		)
		expect(opening).toContain('framingAspect: stored.framingAspect')
	})

	it('is handed the host’s distance limits by the viewer', () => {
		expect(
			viewer.match(/distanceLimits=\{orbitDistanceLimits\}/g)
		).toHaveLength(2)
	})
})

describe('captures render the stored pose', () => {
	const capture = slice(
		model,
		'if (options.targetCameraId && cameraOptions?.cameras) {',
		'// Two frames let the scene settle'
	)

	it('resolves the camera without a viewport, so the pose is not fitted', () => {
		const resolve = slice(capture, 'resolveCameraPose(', 'openingPose.current')
		expect(resolve).not.toContain('viewportAspect')
		expect(capture).not.toContain('resolveCameraSelection(')
	})

	it('clamps against the host’s unscaled limits, in both capture modes', () => {
		expect(
			capture.match(
				/unfittedOrbitLimits\(controls, distanceLimits \?\? \{\}\)/g
			)
		).toHaveLength(2)
		expect(capture).not.toMatch(/limits: controls\s*[},]/)
	})
})
