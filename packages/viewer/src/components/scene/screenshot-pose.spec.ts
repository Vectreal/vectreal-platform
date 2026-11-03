import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CameraFraming, framingScale } from '@vctrl/core/scene-camera'
import { Euler, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { resolveCameraSelection } from './scene-camera'
import {
	buildCaptureCamera,
	captureOrbitLimits,
	centeredCaptureRegion,
	resolveCapturePose,
	viewCaptureCamera
} from './screenshot-pose'

import type { SceneCameraSnapshot } from '../../types/viewer-types'
import type { CameraConfig } from '@vctrl/core'

const liveCamera = () => {
	const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 100)
	camera.position.set(3, 2, 1)
	camera.lookAt(0, 0, 0)
	camera.zoom = 1.5
	camera.updateProjectionMatrix()
	return camera
}

describe('buildCaptureCamera', () => {
	it('leaves the live camera where its owners put it', () => {
		const live = liveCamera()
		const position = live.position.clone()
		const quaternion = live.quaternion.clone()

		buildCaptureCamera(
			live,
			{
				position: new Vector3(0, 0, 10),
				fov: 30,
				lookAt: new Vector3(0, 1, 0)
			},
			16 / 9
		)

		expect(live.position.equals(position)).toBe(true)
		expect(live.quaternion.equals(quaternion)).toBe(true)
		expect(live.fov).toBe(50)
	})

	it('renders the pose it was given, aimed at its point', () => {
		const capture = buildCaptureCamera(
			liveCamera(),
			{
				position: new Vector3(0, 0, 10),
				fov: 30,
				lookAt: new Vector3(0, 0, 0)
			},
			16 / 9
		)

		expect(capture.position.toArray()).toEqual([0, 0, 10])
		expect(capture.fov).toBe(30)
		const forward = capture.getWorldDirection(new Vector3())
		expect(forward.z).toBeCloseTo(-1)
	})

	it('keeps the rotation of a pose with no point to aim at', () => {
		const rotation = new Euler(0.1, 0.2, 0.3)
		const capture = buildCaptureCamera(
			liveCamera(),
			{
				position: new Vector3(1, 1, 1),
				fov: 40,
				rotation
			},
			16 / 9
		)

		expect(capture.rotation.equals(rotation)).toBe(true)
	})

	it('projects with the fov it was given', () => {
		const capture = buildCaptureCamera(
			liveCamera(),
			{
				position: new Vector3(0, 0, 10),
				fov: 30,
				lookAt: new Vector3()
			},
			16 / 9
		)
		const expected = liveCamera()
		expected.fov = 30
		expected.updateProjectionMatrix()

		expect(capture.projectionMatrix.equals(expected.projectionMatrix)).toBe(
			true
		)
	})

	describe('held to orbit limits', () => {
		const limits = {
			minPolarAngle: 0,
			maxPolarAngle: Math.PI / 2,
			minAzimuthAngle: -Infinity,
			maxAzimuthAngle: Infinity,
			minDistance: 0,
			maxDistance: Infinity
		}

		it('lifts a pose below the horizon onto it, as the controls do', () => {
			const capture = buildCaptureCamera(
				liveCamera(),
				{
					position: new Vector3(0, -3, 4),
					fov: 50,
					lookAt: new Vector3(),
					limits
				},
				16 / 9
			)

			expect(capture.position.y).toBeCloseTo(0)
			expect(capture.position.z).toBeCloseTo(5)
		})

		it('pulls a pose inside the distance range', () => {
			const capture = buildCaptureCamera(
				liveCamera(),
				{
					position: new Vector3(0, 0, 20),
					fov: 50,
					lookAt: new Vector3(),
					limits: { ...limits, maxDistance: 8 }
				},
				16 / 9
			)

			expect(capture.position.toArray().map((v) => +v.toFixed(6))).toEqual([
				0, 0, 8
			])
		})

		it('keeps an azimuth inside its range', () => {
			const capture = buildCaptureCamera(
				liveCamera(),
				{
					position: new Vector3(5, 0, 0),
					fov: 50,
					lookAt: new Vector3(),
					limits: { ...limits, minAzimuthAngle: -0.5, maxAzimuthAngle: 0.5 }
				},
				16 / 9
			)

			expect(Math.atan2(capture.position.x, capture.position.z)).toBeCloseTo(
				0.5
			)
		})

		it('leaves a pose inside every limit where it is', () => {
			const capture = buildCaptureCamera(
				liveCamera(),
				{
					position: new Vector3(3, 2, 1),
					fov: 50,
					lookAt: new Vector3(),
					limits
				},
				16 / 9
			)

			expect(capture.position.distanceTo(new Vector3(3, 2, 1))).toBeLessThan(
				1e-9
			)
		})
	})

	it("takes the output's aspect and keeps the live camera's zoom", () => {
		const capture = buildCaptureCamera(
			liveCamera(),
			{ position: new Vector3(0, 0, 10), fov: 30, lookAt: new Vector3() },
			1
		)

		expect(capture.aspect).toBe(1)
		expect(capture.zoom).toBe(1.5)
	})
})

/*
  The invariant thumbnails exist for: a capture of a camera at an output
  aspect is the frame the viewer shows of that camera on a viewport of the same
  aspect. The viewer side is `resolveCameraSelection`, applied as the rig
  applies it (position, fov, and orbit controls aiming at the target).
*/
describe('a capture frames a camera as the viewer does at its aspect', () => {
	const CANVAS_ASPECTS = [0.6, 1.2, 2.4]
	const OUTPUT_ASPECTS = [9 / 16, 1, 16 / 9, 2.4]
	const STORED_FRAMING_ASPECTS = [undefined, 1.2, 16 / 9, 2.4]

	const storedCamera = (framingAspect?: number): CameraConfig => ({
		cameraId: 'opening',
		name: 'Opening',
		position: [2.5, 1.4, 3.2],
		target: [0, 0.4, 0],
		fov: 42,
		...(framingAspect === undefined ? {} : { framingAspect })
	})

	const viewerAt = (
		cameras: CameraConfig[],
		cameraId: string,
		aspect: number
	) => {
		const camera = new PerspectiveCamera(50, aspect, 0.1, 100)
		const selection = resolveCameraSelection(
			cameras,
			cameraId,
			new Vector3(),
			camera
		)
		camera.position.copy(selection.targetPosition)
		camera.fov = selection.targetFov
		camera.lookAt(selection.targetLookAt)
		camera.updateProjectionMatrix()
		camera.updateMatrixWorld()
		return camera
	}

	const captureAt = (
		cameras: CameraConfig[],
		cameraId: string,
		canvasAspect: number,
		outputAspect: number
	) => {
		const live = new PerspectiveCamera(50, canvasAspect, 0.1, 100)
		live.position.set(9, 9, 9)
		const pose = resolveCapturePose(
			cameras,
			cameraId,
			{ position: live.position, target: new Vector3(), fov: live.fov },
			outputAspect,
			null,
			unlimited,
			{}
		)
		return buildCaptureCamera(live, pose, outputAspect)
	}

	const expectSameFrame = (a: PerspectiveCamera, b: PerspectiveCamera) => {
		a.projectionMatrix.elements.forEach((value, index) =>
			expect(b.projectionMatrix.elements[index]).toBeCloseTo(value, 9)
		)
		a.matrixWorld.elements.forEach((value, index) =>
			expect(b.matrixWorld.elements[index]).toBeCloseTo(value, 9)
		)
	}

	for (const framingAspect of STORED_FRAMING_ASPECTS) {
		for (const outputAspect of OUTPUT_ASPECTS) {
			for (const canvasAspect of CANVAS_ASPECTS) {
				it(`a camera framed at ${framingAspect?.toFixed(2) ?? 'legacy'}, output ${outputAspect.toFixed(2)}, canvas ${canvasAspect}`, () => {
					const cameras = [storedCamera(framingAspect)]
					expectSameFrame(
						viewerAt(cameras, 'opening', outputAspect),
						captureAt(cameras, 'opening', canvasAspect, outputAspect)
					)
				})
			}
		}
	}

	// A viewport capture is saved with the camera snapshot, so it is the frame
	// that saved camera reopens on: framed wide on a narrow canvas (backed off),
	// and framed narrow on a wide one (not backed off, saved at the canvas's
	// width).
	it.each([
		{ framedAt: 2.4, canvasAspect: 1.2 },
		{ framedAt: 1, canvasAspect: 2 }
	])(
		'the view on screen, saved as the opening camera, captures as it reopens ($framedAt framed on $canvasAspect)',
		({ framedAt, canvasAspect }) => {
			const shown = [storedCamera(framedAt)]
			const live = viewerAt(shown, 'opening', canvasAspect)
			const framing = new CameraFraming(canvasAspect)
			framing.show({
				aspect: framedAt,
				scale: framingScale(framedAt, canvasAspect)
			})
			const target = new Vector3(0, 0.4, 0)
			const stored = framing.storedPose(live.position, target, canvasAspect)
			const snapshot = {
				position: stored.position.toArray(),
				rotation: [live.rotation.x, live.rotation.y, live.rotation.z],
				target: target.toArray(),
				fov: live.fov,
				framingAspect: stored.framingAspect,
				viewportAspect: canvasAspect
			} satisfies SceneCameraSnapshot

			// What "set as opening view" saves, and what the scene then opens on.
			const saved: CameraConfig = {
				...storedCamera(),
				position: snapshot.position,
				target: snapshot.target,
				fov: snapshot.fov,
				framingAspect: snapshot.framingAspect
			}
			const view = viewCaptureCamera(snapshot)

			for (const outputAspect of OUTPUT_ASPECTS) {
				expectSameFrame(
					viewerAt([saved], 'opening', outputAspect),
					captureAt([view], view.cameraId, canvasAspect, outputAspect)
				)
			}
		}
	)

	it('holds a fitted capture to the limits the viewer holds it to', () => {
		// Framed at 2.4 and captured square: backed off 2.4x, past a host limit
		// of 6 that the viewer scales to 14.4 for this fit.
		const pose = resolveCapturePose(
			[storedCamera(2.4)],
			'opening',
			{ position: new Vector3(), target: new Vector3(), fov: 50 },
			1,
			null,
			unlimited,
			{ maxDistance: 6 }
		)

		expect('limits' in pose && pose.limits?.maxDistance).toBeCloseTo(14.4)
	})
})

const unlimited = {
	minPolarAngle: 0,
	maxPolarAngle: Math.PI,
	minAzimuthAngle: -Infinity,
	maxAzimuthAngle: Infinity,
	minDistance: 0,
	maxDistance: Infinity
}

describe('centeredCaptureRegion', () => {
	it('trims the sides of a canvas wider than the output', () => {
		expect(centeredCaptureRegion(2400, 1000, 2)).toEqual({
			x: 200,
			y: 0,
			width: 2000,
			height: 1000
		})
	})

	it('keeps to whole pixels, so the region drawn is the region read', () => {
		// 1001 x 600 at 16:9: 563.06 rows, inset 18.47.
		expect(centeredCaptureRegion(1001, 600, 16 / 9)).toEqual({
			x: 0,
			y: 18,
			width: 1001,
			height: 563
		})
		expect(centeredCaptureRegion(1001, 500, 1)).toEqual({
			x: 250,
			y: 0,
			width: 500,
			height: 500
		})
	})

	it('trims the top and bottom of a canvas narrower than the output', () => {
		expect(centeredCaptureRegion(1000, 1000, 2)).toEqual({
			x: 0,
			y: 250,
			width: 1000,
			height: 500
		})
	})
})

/*
  SceneModel's capture is a closure inside an R3F component and cannot run
  without a WebGL context, so this proves it renders through the rule above.
*/
describe('the scene screenshot', () => {
	const model = readFileSync(
		join(import.meta.dirname, 'scene-model.tsx'),
		'utf8'
	)
	const capture = model.slice(
		model.indexOf('const captureScreenshot'),
		model.indexOf('onScreenshotCaptureReady?.(captureScreenshot)')
	)

	it('renders a posed capture through a camera of its own, shaped like the output', () => {
		expect(capture).toMatch(
			/const captureCamera = buildCaptureCamera\(\s*activeCamera,\s*pose,\s*outputAspect\s*\)/
		)
		expect(capture).toMatch(
			/const outputAspect = options\.width \/ options\.height/
		)
	})

	it('draws it into the region the image is read from', () => {
		expect(capture).toMatch(
			/const region = centeredCaptureRegion\(\s*canvas\.width,\s*canvas\.height,\s*outputAspect\s*\)/
		)
		expect(capture).toMatch(
			/gl\.setViewport\(\s*region\.x \/ pixelRatio,\s*\(canvas\.height - region\.y - region\.height\) \/ pixelRatio,\s*region\.width \/ pixelRatio,\s*region\.height \/ pixelRatio\s*\)\s*gl\.render\(scene, captureCamera\)/
		)
		expect(capture).toMatch(
			/buildScreenshotDataUrl\(\s*canvas,\s*region,\s*pose !== null,/
		)
		expect(capture).toMatch(/finally \{\s*gl\.setViewport\(viewport\)/)
	})

	it('never writes the live camera or its controls', () => {
		expect(capture).not.toMatch(
			/activeCamera\.(position|rotation|quaternion)\.(copy|set)|activeCamera\.(fov|zoom|aspect) =|activeCamera\.lookAt|controls\??\.target\??\.copy|controls\??\.enabled =|controls\??\.update/
		)
	})

	it('resolves a stored camera and the view on screen at the output aspect', () => {
		expect(
			capture.match(
				/resolveCapturePose\(\s*[^,]+,\s*[^,]+,\s*live,\s*outputAspect,/g
			)
		).toHaveLength(2)
		expect(capture).toMatch(
			/const view = storedView\?\.current\?\.\(\)[\s\S]*?viewCaptureCamera\(view\)/
		)
		expect(capture).not.toContain('resolveCameraPose(')
	})

	it('solves an auto-fit framing for the output aspect and holds its fov', () => {
		expect(capture).toMatch(
			/solveAutoFitFraming\(\s*object,\s*activeCamera,\s*outputAspect\s*\)[\s\S]{0,300}?fov: activeCamera\.fov/
		)
	})
})

describe('captureOrbitLimits', () => {
	const live = {
		minPolarAngle: 0.1,
		maxPolarAngle: 1.5,
		minAzimuthAngle: -1,
		maxAzimuthAngle: 1,
		minDistance: 6,
		maxDistance: 30
	}

	it("scales the host's distance limits by the capture's fit, not the live view's", () => {
		// The view on screen is fitted 3x, so the live controls carry 3x limits.
		expect(
			captureOrbitLimits(live, { minDistance: 2, maxDistance: 10 }, 1.5)
		).toEqual({ ...live, minDistance: 3, maxDistance: 15 })
	})

	it('leaves the distance unbounded where the host set no limit', () => {
		expect(captureOrbitLimits(live, {}, 2)).toMatchObject({
			minDistance: 0,
			maxDistance: Infinity
		})
	})
})
