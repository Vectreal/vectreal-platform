/**
 * The first view of a model is final by the time `initializeCamera` returns.
 *
 * It used to go through drei's `bounds.reset()`, which only records a goal and
 * moves the camera on a later frame. Everything that reads the pose sooner saw
 * the default camera at [0, 0, 5] instead. That includes the stability check
 * that reports `initial_framing_completed` and the publisher's automatic
 * opening view, which writes the pose it reads into the default camera, where
 * SceneCamera applies it on top of the fit. A 14 cm model ended up a few
 * pixels across and the rocket was viewed from inside its own hull.
 *
 * The fake bounds keep two parts of drei's contract a test can be fooled by:
 * `reset()` records and does not move, and `getSize()` reports whatever the
 * last `refresh()` measured. The controls are three's real OrbitControls, so
 * their polar clamp and their final `lookAt(target)` act on the pose as they
 * do in the viewer.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Box3, Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { describe, expect, it, vi } from 'vitest'

import { applyInitialFraming } from './initial-framing'

import type { BoundsApi } from '@react-three/drei'

/**
 * Until `refresh()` runs, drei still holds its previous measurement. On a
 * fresh mount that is its empty-group fallback: a cube 5 units across around
 * the origin.
 */
const STALE_BOX = new Box3().setFromCenterAndSize(
	new Vector3(),
	new Vector3(5, 5, 5)
)
const STALE_DISTANCE = 7.5

function fakeBounds(box: Box3, distance: number) {
	const calls: string[] = []
	let measured = { box: STALE_BOX, distance: STALE_DISTANCE }
	const api = {
		calls,
		refresh: vi.fn(() => {
			calls.push('refresh')
			measured = { box, distance }
			return api
		}),
		getSize: () => {
			calls.push('getSize')
			return {
				box: measured.box,
				size: measured.box.getSize(new Vector3()),
				center: measured.box.getCenter(new Vector3()),
				distance: measured.distance
			}
		},
		// drei's reset(): sets a goal for a later frame and leaves the camera alone.
		reset: vi.fn(() => api),
		fit: vi.fn(() => api),
		clip: vi.fn(() => {
			calls.push('clip')
			return api
		})
	}
	return api as typeof api & BoundsApi
}

/** The viewer's orbit controls: `maxPolarAngle` from SceneControls' defaults. */
function viewerControls(camera: PerspectiveCamera) {
	const controls = new OrbitControls(camera)
	controls.maxPolarAngle = Math.PI / 2
	return controls
}

/**
 * A reader before the next render sees the final pose. Call it before anything
 * that refreshes the matrix as a side effect, such as `getWorldDirection()`.
 */
function expectMatrixWorldCurrent(camera: PerspectiveCamera) {
	const composed = new Matrix4().compose(
		camera.position,
		camera.quaternion,
		camera.scale
	)
	camera.matrixWorld.elements.forEach((value, index) => {
		expect(value).toBeCloseTo(composed.elements[index], 9)
	})
}

describe('applyInitialFraming', () => {
	it.each([
		// The Poly Haven camera: authored in metres, 14 cm across.
		[
			'a real-world-scale model',
			new Vector3(0, 0.045, 0),
			new Vector3(0.14, 0.09, 0.07),
			0.2
		],
		// The rocket: 18 units across, larger than the camera's distance to it.
		[
			'a model larger than the default camera distance',
			new Vector3(0, 3.5, 0),
			new Vector3(7, 7, 15),
			23.6
		],
		// Off the world axis, so the approach is measured from the model and
		// not from the origin.
		[
			'a model placed away from the origin',
			new Vector3(6, 1, -3),
			new Vector3(2, 2, 2),
			3
		]
	])(
		'moves the camera to the fit before returning, for %s',
		(_label, modelCenter, size, distance) => {
			const box = new Box3().setFromCenterAndSize(modelCenter, size)
			const center = box.getCenter(new Vector3())
			const camera = new PerspectiveCamera(60, 16 / 9)
			// Below the model's centre, so the controls' clamp has work to do.
			camera.position.set(2, 0, 4)
			const controls = viewerControls(camera)
			const approach = camera.position.clone().sub(center).setY(0).normalize()

			applyInitialFraming(fakeBounds(box, distance), camera, controls, true)

			expectMatrixWorldCurrent(camera)

			expect(camera.position.distanceTo(center)).toBeCloseTo(distance, 6)
			expect(controls.target.distanceTo(center)).toBeCloseTo(0, 9)
			// The controls' clamp kept: no view from beneath the model.
			expect(camera.position.y).toBeGreaterThanOrEqual(center.y - 1e-9)
			// Same side of the model the camera was already on.
			const side = camera.position.clone().sub(center).setY(0).normalize()
			expect(side.dot(approach)).toBeCloseTo(1, 6)
			// Aimed at the model.
			const facing = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
			const toCenter = center.clone().sub(camera.position).normalize()
			expect(facing.dot(toCenter)).toBeCloseTo(1, 6)
		}
	)

	it("keeps the controls' distance limits, as drei's fit did", () => {
		// A surface can set `maxDistance` through ControlsProps. Left unclamped,
		// the controls' next per-frame update would move the camera after this
		// returned, which is the delay this exists to remove.
		const box = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1))
		const center = box.getCenter(new Vector3())
		const camera = new PerspectiveCamera(60, 16 / 9)
		camera.position.set(0, 0, 5)
		const controls = viewerControls(camera)
		controls.maxDistance = 3

		applyInitialFraming(fakeBounds(box, 8), camera, controls, true)

		expect(camera.position.distanceTo(center)).toBeCloseTo(3, 6)
	})

	it('aims at the model when the controls are not registered yet', () => {
		const box = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1))
		const center = box.getCenter(new Vector3())
		const camera = new PerspectiveCamera(60, 16 / 9)
		camera.position.set(0, 0, 5)

		applyInitialFraming(fakeBounds(box, 4), camera, null, true)

		expectMatrixWorldCurrent(camera)
		const facing = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
		const toCenter = center.clone().sub(camera.position).normalize()
		expect(facing.dot(toCenter)).toBeCloseTo(1, 6)
	})

	it('measures the model before fitting, and drops any fit drei is still animating toward', () => {
		// SceneModel's normalization refit calls `refresh(object).fit()` on first
		// mount. Left in flight, it would move the camera after this returned.
		const bounds = fakeBounds(
			new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1)),
			4
		)

		applyInitialFraming(bounds, new PerspectiveCamera(), null, true)

		expect(bounds.calls).toEqual(['refresh', 'getSize'])
		expect(bounds.reset).not.toHaveBeenCalled()
		expect(bounds.fit).not.toHaveBeenCalled()
	})

	it('leaves a saved camera where the scene stored it', () => {
		const bounds = fakeBounds(
			new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1)),
			4
		)
		const camera = new PerspectiveCamera(60, 16 / 9)
		camera.position.set(3, 2, 1)
		camera.lookAt(0.5, 0.5, 0.5)
		const storedPosition = camera.position.clone()
		const storedQuaternion = camera.quaternion.clone()
		const controls = { target: new Vector3(0.5, 0.5, 0.5), update: vi.fn() }

		applyInitialFraming(bounds, camera, controls, false)

		expect(camera.position.toArray()).toEqual(storedPosition.toArray())
		expect(camera.quaternion.toArray()).toEqual(storedQuaternion.toArray())
		expect(controls.target.toArray()).toEqual([0.5, 0.5, 0.5])
		expect(controls.update).not.toHaveBeenCalled()
		// Refreshed first: that is what cancels an in-flight refit here too, and
		// what `clip()` measures.
		expect(bounds.calls).toEqual(['refresh', 'clip'])
		expect(bounds.reset).not.toHaveBeenCalled()
	})
})

/**
 * A source guard, for the reason `hotspot-camera-wiring.spec.ts` gives: this
 * runner has no GL context to mount SceneCamera, and a wrong call site
 * type-checks and leaves every test above green. Pinned as one expression:
 * after the saved selection (applied first, or it would overwrite the fit),
 * in the same tick, with the controls read live and the saved-camera switch.
 * Re-point the guard if the call is reworded rather than deleting it.
 */
describe('SceneCamera frames the first view through applyInitialFraming', () => {
	const source = readFileSync(
		join(import.meta.dirname, 'scene-camera.tsx'),
		'utf8'
	)

	it('calls it right after applying the selection, with live controls', () => {
		// Comment lines between the two calls are skipped only whole, so a
		// commented-out call cannot satisfy the match.
		expect(source).toMatch(
			/applyCameraInstantly\(selection\)\s*(?:\/\/[^\n]*\n\s*)*applyInitialFraming\(\s*bounds,\s*sceneCamera,\s*getThreeState\(\)\.controls as InitialFramingControls \| null,\s*boundsEnabled\s*\)/
		)
		// `get` reads the store when called; a selector returning the state
		// would hand back this render's snapshot instead.
		expect(source).toMatch(
			/const getThreeState = useThree\(\(state\) => state\.get\)/
		)
	})

	it('never hands the first view to drei', () => {
		expect(source).not.toMatch(/\.reset\(\)/)
		expect(source).not.toMatch(/\.fit\(\)/)
	})
})
