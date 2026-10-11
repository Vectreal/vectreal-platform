import { PerspectiveCamera, Sphere, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { type ClipExtent, resolveClipPlanes } from './clip-planes'

/** Canvas height in CSS pixels. */
const HEIGHT = 800

const view = (position: Vector3, target: Vector3) => {
	const camera = new PerspectiveCamera(50, 1, 0.1, 1000)
	camera.position.copy(position)
	camera.lookAt(target)
	camera.updateMatrixWorld()
	camera.updateProjectionMatrix()
	return camera
}

/** Depth along the view direction, worked out here rather than by the module. */
const depthOf = (camera: PerspectiveCamera, point: Vector3) =>
	point
		.clone()
		.sub(camera.position)
		.dot(camera.getWorldDirection(new Vector3()))

/** The default shadow ground: 2.5 × a unit footprint, centered under the model. */
const ground = (half = 1.25): ClipExtent[] => [
	{
		kind: 'polygon',
		corners: [
			new Vector3(-half, 0, -half),
			new Vector3(half, 0, -half),
			new Vector3(half, 0, half),
			new Vector3(-half, 0, half)
		]
	}
]

const handle = (
	center: Vector3,
	radius = 0.075,
	screenRadius?: number
): ClipExtent[] => [{ kind: 'sphere', center, radius, screenRadius }]

describe('resolveClipPlanes', () => {
	const model = new Sphere(new Vector3(0, 0.5, 0), 0.5)

	it('keeps the far edge of the shadow ground inside the far plane', () => {
		const camera = view(new Vector3(0, 1, 3), model.center)
		const farCorner = new Vector3(1.25, 0, -1.25)

		const { far } = resolveClipPlanes(camera, model, [ground()], HEIGHT)

		// The corner is past the model's sphere, so a model-only far cuts it.
		expect(depthOf(camera, farCorner)).toBeGreaterThan(
			depthOf(camera, model.center) + model.radius
		)
		expect(far).toBeGreaterThan(depthOf(camera, farCorner))
	})

	it('keeps a light handle between the camera and the model inside the near plane', () => {
		const camera = view(new Vector3(0, 1, 3), model.center)
		const light = new Vector3(0, 1.2, 2)

		const { near } = resolveClipPlanes(camera, model, [handle(light)], HEIGHT)

		expect(near).toBeLessThan(depthOf(camera, light) - 0.075)
	})

	it('keeps arrows drawn at a fixed screen size inside the near plane', () => {
		const camera = view(new Vector3(0, 1, 3), model.center)
		const light = new Vector3(0, 1.2, 2)
		const depth = depthOf(camera, light)
		// 95px at that depth on a 400px canvas, worked out from the fov.
		const arrow = (95 * 2 * Math.tan((25 * Math.PI) / 180) * depth) / 400

		const { near } = resolveClipPlanes(
			camera,
			model,
			[handle(light, 0.075, 95)],
			400
		)

		expect(near).toBeLessThan(depth - 0.075 - arrow)
	})

	it('ignores a handle outside the view', () => {
		const camera = view(new Vector3(0, 1, 3), model.center)
		// In front of the camera but well to its side.
		const beside = new Vector3(2, 1, 2.5)

		const withHandle = resolveClipPlanes(
			camera,
			model,
			[handle(beside)],
			HEIGHT
		)
		const modelOnly = resolveClipPlanes(camera, model, [], HEIGHT)

		expect(depthOf(camera, beside)).toBeGreaterThan(0)
		expect(withHandle.near).toBe(modelOnly.near)
	})

	it('ignores a handle behind the camera', () => {
		const camera = view(new Vector3(0, 1, 3), model.center)

		const withHandle = resolveClipPlanes(
			camera,
			model,
			[handle(new Vector3(0, 1, 4))],
			HEIGHT
		)
		const modelOnly = resolveClipPlanes(camera, model, [], HEIGHT)

		expect(withHandle.near).toBe(modelOnly.near)
	})

	describe('a ground that runs under the camera', () => {
		// Low and level, close in: the ground reaches past the camera, and the
		// bottom of the view meets it at height / tan(fov / 2).
		const small = new Sphere(new Vector3(0, 0.3, 0), 0.3)
		const camera = view(new Vector3(0, 0.3, 1.2), new Vector3(0, 0.3, 0))
		const groundEntersView = 0.3 / Math.tan((25 * Math.PI) / 180)

		it('bounds the near plane where the ground enters the view', () => {
			const { near } = resolveClipPlanes(camera, small, [ground()], HEIGHT)

			expect(depthOf(camera, small.center) - small.radius).toBeGreaterThan(
				groundEntersView
			)
			expect(near).toBeLessThan(groundEntersView)
		})

		it('does not drop the near plane to the floor for the part behind the camera', () => {
			const { near } = resolveClipPlanes(camera, small, [ground()], HEIGHT)

			expect(near).toBeGreaterThan(groundEntersView * 0.8)
		})
	})

	it('fits a model with nothing else drawn as tightly as before', () => {
		const camera = view(new Vector3(0, 1, 3), model.center)
		const distance = depthOf(camera, model.center)

		const { near, far } = resolveClipPlanes(camera, model, [], HEIGHT)

		expect(near).toBeLessThan(distance - model.radius)
		expect(near).toBeGreaterThan((distance - model.radius) * 0.85)
		expect(far).toBeGreaterThan(distance + model.radius)
		expect(far).toBeLessThan((distance + model.radius) * 1.15)
	})
})
