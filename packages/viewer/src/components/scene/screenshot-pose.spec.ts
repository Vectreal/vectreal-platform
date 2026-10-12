import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { renderAtPose } from './screenshot-pose'

describe('renderAtPose', () => {
	it('renders the requested pose when the camera is driven during the wait', async () => {
		const camera = { pose: 'live' }
		let rendered: string | null = null

		await renderAtPose({
			applyPose: () => {
				camera.pose = 'requested'
			},
			invalidate: () => undefined,
			// A camera transition writes its in-between pose on every frame.
			waitForNextFrame: async () => {
				camera.pose = 'in-between'
			},
			render: () => {
				rendered = camera.pose
			}
		})

		expect(rendered).toBe('requested')
	})

	it('waits two frames before it renders', async () => {
		const calls: string[] = []

		await renderAtPose({
			applyPose: () => calls.push('pose'),
			invalidate: () => calls.push('invalidate'),
			waitForNextFrame: async () => {
				calls.push('frame')
			},
			render: () => calls.push('render')
		})

		expect(calls.filter((call) => call === 'frame')).toHaveLength(2)
		expect(calls.at(-1)).toBe('render')
		expect(calls.at(-2)).toBe('pose')
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

	it('renders through renderAtPose', () => {
		expect(model).toMatch(
			/await renderAtPose\(\{\s*applyPose,\s*invalidate,\s*waitForNextFrame,\s*render: \(\) => gl\.render\(scene, activeCamera\)\s*\}\)/
		)
		expect(model).not.toMatch(/\n\s*gl\.render\(scene, activeCamera\)\n/)
	})

	it('holds the fov an auto-fit framing was solved for', () => {
		expect(model).toMatch(
			/const framedFov = activeCamera\.fov\s*setCapturePose = \(\) => \{\s*activeCamera\.fov = framedFov/
		)
	})

	it("resolves a target camera's pose with the viewer's camera resolver", () => {
		expect(model).toMatch(
			/const selection = resolveCameraSelection\(\s*cameraOptions\.cameras,\s*targetCameraConfig\.cameraId,\s*initialControlsTarget \?\? new Vector3\(\),\s*activeCamera\s*\)/
		)
	})

	it('fits the clip planes to the pose it renders', () => {
		expect(model).toMatch(
			/const applyPose = \(\) => \{\s*setCapturePose\(\)\s*activeCamera\.updateProjectionMatrix\(\)\s*controls\?\.update\(\)[\s\S]{0,300}?fitClipPlanes\(\)\s*\}/
		)
		expect(model).toContain('useFrame(fitClipPlanes)')
	})
})
