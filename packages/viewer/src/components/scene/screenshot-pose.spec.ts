import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Euler, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { buildCaptureCamera } from './screenshot-pose'

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

		buildCaptureCamera(live, {
			position: new Vector3(0, 0, 10),
			fov: 30,
			lookAt: new Vector3(0, 1, 0)
		})

		expect(live.position.equals(position)).toBe(true)
		expect(live.quaternion.equals(quaternion)).toBe(true)
		expect(live.fov).toBe(50)
	})

	it('renders the pose it was given, aimed at its point', () => {
		const capture = buildCaptureCamera(liveCamera(), {
			position: new Vector3(0, 0, 10),
			fov: 30,
			lookAt: new Vector3(0, 0, 0)
		})

		expect(capture.position.toArray()).toEqual([0, 0, 10])
		expect(capture.fov).toBe(30)
		const forward = capture.getWorldDirection(new Vector3())
		expect(forward.z).toBeCloseTo(-1)
	})

	it('keeps the rotation of a pose with no point to aim at', () => {
		const rotation = new Euler(0.1, 0.2, 0.3)
		const capture = buildCaptureCamera(liveCamera(), {
			position: new Vector3(1, 1, 1),
			fov: 40,
			rotation
		})

		expect(capture.rotation.equals(rotation)).toBe(true)
	})

	it('projects with the fov it was given', () => {
		const capture = buildCaptureCamera(liveCamera(), {
			position: new Vector3(0, 0, 10),
			fov: 30,
			lookAt: new Vector3()
		})
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
			const capture = buildCaptureCamera(liveCamera(), {
				position: new Vector3(0, -3, 4),
				fov: 50,
				lookAt: new Vector3(),
				limits
			})

			expect(capture.position.y).toBeCloseTo(0)
			expect(capture.position.z).toBeCloseTo(5)
		})

		it('pulls a pose inside the distance range', () => {
			const capture = buildCaptureCamera(liveCamera(), {
				position: new Vector3(0, 0, 20),
				fov: 50,
				lookAt: new Vector3(),
				limits: { ...limits, maxDistance: 8 }
			})

			expect(capture.position.toArray().map((v) => +v.toFixed(6))).toEqual([
				0, 0, 8
			])
		})

		it('keeps an azimuth inside its range', () => {
			const capture = buildCaptureCamera(liveCamera(), {
				position: new Vector3(5, 0, 0),
				fov: 50,
				lookAt: new Vector3(),
				limits: { ...limits, minAzimuthAngle: -0.5, maxAzimuthAngle: 0.5 }
			})

			expect(Math.atan2(capture.position.x, capture.position.z)).toBeCloseTo(
				0.5
			)
		})

		it('leaves a pose inside every limit where it is', () => {
			const capture = buildCaptureCamera(liveCamera(), {
				position: new Vector3(3, 2, 1),
				fov: 50,
				lookAt: new Vector3(),
				limits
			})

			expect(capture.position.distanceTo(new Vector3(3, 2, 1))).toBeLessThan(
				1e-9
			)
		})
	})

	it("keeps the live camera's aspect and zoom", () => {
		const capture = buildCaptureCamera(liveCamera(), {
			position: new Vector3(0, 0, 10),
			fov: 30,
			lookAt: new Vector3()
		})

		expect(capture.aspect).toBe(16 / 9)
		expect(capture.zoom).toBe(1.5)
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

	it('renders a posed capture through a camera of its own', () => {
		expect(capture).toMatch(
			/const captureCamera = buildCaptureCamera\(activeCamera, pose\)\s*(\/\/.*\s*)*fitClipPlanes\(captureCamera\)\s*gl\.render\(scene, captureCamera\)/
		)
	})

	it('never writes the live camera or its controls', () => {
		expect(capture).not.toMatch(
			/activeCamera\.(position|rotation|quaternion)\.(copy|set)|activeCamera\.(fov|zoom) =|activeCamera\.lookAt|controls\??\.target\??\.copy|controls\??\.enabled =|controls\??\.update/
		)
	})

	it("holds both posed captures to the live controls' limits", () => {
		expect(
			capture.match(
				/lookAt: (selection\.targetLookAt|framing\.target),\s*limits: controls/g
			)
		).toHaveLength(2)
	})

	it("resolves a target camera's pose with the viewer's camera resolver", () => {
		expect(capture).toMatch(
			/const selection = resolveCameraSelection\(\s*cameraOptions\.cameras,\s*targetCameraConfig\.cameraId,/
		)
	})

	it('holds the fov an auto-fit framing was solved for', () => {
		expect(capture).toMatch(
			/solveAutoFitFraming\(object, activeCamera\)[\s\S]{0,200}?fov: activeCamera\.fov/
		)
	})
})
