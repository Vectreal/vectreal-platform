import { Group, Mesh, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import {
	ACCUMULATION_SAMPLES,
	computeSceneSignature,
	createRenderActivity,
	JITTER_OFFSETS,
	type ActivityInputs
} from './render-activity'

const setup = () => {
	const camera = new PerspectiveCamera(50, 1, 0.1, 100)
	camera.position.set(0, 0, 5)
	camera.updateMatrixWorld()
	const scene = new Group()
	const model = new Mesh()
	scene.add(model)
	scene.updateMatrixWorld()

	const activity = createRenderActivity()
	const inputs = (overrides: Partial<ActivityInputs> = {}): ActivityInputs => ({
		camera,
		width: 800,
		height: 600,
		sceneSignature: computeSceneSignature(scene),
		invalidated: false,
		active: false,
		...overrides
	})

	/** Runs frames until the viewer has converged, returning what each was. */
	const settle = () => {
		const kinds: string[] = []
		for (let i = 0; i < ACCUMULATION_SAMPLES + 2; i++) {
			kinds.push(activity.plan(inputs()).kind)
		}
		return kinds
	}

	return { camera, scene, model, activity, inputs, settle }
}

describe('render activity', () => {
	it('draws a plain frame first, then accumulates every sample, then stops', () => {
		const { settle } = setup()
		const kinds = settle()

		expect(kinds[0]).toBe('motion')
		expect(kinds.slice(1, ACCUMULATION_SAMPLES + 1)).toEqual(
			Array(ACCUMULATION_SAMPLES).fill('accumulate')
		)
		expect(kinds[ACCUMULATION_SAMPLES + 1]).toBe('converged')
	})

	it('numbers the samples from zero, so the first one replaces the history', () => {
		const { activity, inputs } = setup()
		activity.plan(inputs())

		const samples: number[] = []
		for (let i = 0; i < ACCUMULATION_SAMPLES; i++) {
			const plan = activity.plan(inputs())
			if (plan.kind === 'accumulate') samples.push(plan.sample)
		}

		expect(samples).toEqual([...Array(ACCUMULATION_SAMPLES).keys()])
	})

	it('restarts when the camera moves', () => {
		const { activity, camera, inputs, settle } = setup()
		settle()

		camera.position.x += 0.01
		camera.updateMatrixWorld()

		expect(activity.plan(inputs()).kind).toBe('motion')
		expect(activity.plan(inputs())).toMatchObject({
			kind: 'accumulate',
			sample: 0
		})
	})

	it('restarts when the projection changes, such as a zoom or near-plane update', () => {
		const { activity, camera, inputs, settle } = setup()
		settle()

		camera.fov = 40
		camera.updateProjectionMatrix()

		expect(activity.plan(inputs()).kind).toBe('motion')
	})

	it('ignores camera drift below what any canvas can show', () => {
		const { activity, camera, inputs, settle } = setup()
		settle()

		camera.position.x += 1e-9
		camera.updateMatrixWorld()

		expect(activity.plan(inputs()).kind).toBe('converged')
	})

	it('restarts when the drawing buffer is resized', () => {
		const { activity, inputs, settle } = setup()
		settle()

		expect(activity.plan(inputs({ width: 801 })).kind).toBe('motion')
		settle()
		expect(activity.plan(inputs({ height: 601 })).kind).toBe('motion')
	})

	it('restarts when something in the scene moves on its own', () => {
		const { activity, model, scene, inputs, settle } = setup()
		settle()

		model.rotation.y = 0.2
		scene.updateMatrixWorld()

		expect(activity.plan(inputs()).kind).toBe('motion')
	})

	it('restarts when an object is hidden', () => {
		const { activity, model, inputs, settle } = setup()
		settle()

		model.visible = false

		expect(activity.plan(inputs()).kind).toBe('motion')
	})

	it('still converges when some object in the graph has a NaN transform', () => {
		const { activity, scene, inputs, settle } = setup()
		const degenerate = new Group()
		degenerate.position.y = Number.NaN
		scene.add(degenerate)
		scene.updateMatrixWorld()

		const kinds = settle()

		expect(kinds.at(-1)).toBe('converged')
		expect(activity.plan(inputs()).kind).toBe('converged')
	})

	it('restarts when anyone invalidated the frame', () => {
		const { activity, inputs, settle } = setup()
		settle()

		expect(activity.plan(inputs({ invalidated: true })).kind).toBe('motion')
	})

	it('stays in motion for as long as the caller says it is active', () => {
		const { activity, inputs, settle } = setup()
		settle()

		for (let i = 0; i < ACCUMULATION_SAMPLES + 2; i++) {
			expect(activity.plan(inputs({ active: true })).kind).toBe('motion')
		}
	})

	it('stays converged while nothing changes', () => {
		const { activity, inputs, settle } = setup()
		settle()

		for (let i = 0; i < 10; i++) {
			expect(activity.plan(inputs()).kind).toBe('converged')
		}
	})
})

describe('jitter offsets', () => {
	it('stays inside one pixel', () => {
		for (const [x, y] of JITTER_OFFSETS) {
			expect(x).toBeGreaterThanOrEqual(-0.5)
			expect(x).toBeLessThan(0.5)
			expect(y).toBeGreaterThanOrEqual(-0.5)
			expect(y).toBeLessThan(0.5)
		}
	})

	it('never repeats a sample, which would weight one position twice', () => {
		const keys = new Set(JITTER_OFFSETS.map(([x, y]) => `${x},${y}`))
		expect(keys.size).toBe(ACCUMULATION_SAMPLES)
	})

	it('averages to the pixel centre, so the converged image is not shifted', () => {
		const mean = JITTER_OFFSETS.reduce(
			([sx, sy], [x, y]) => [sx + x, sy + y],
			[0, 0]
		).map((sum) => sum / JITTER_OFFSETS.length)

		expect(Math.abs(mean[0])).toBeLessThan(0.05)
		expect(Math.abs(mean[1])).toBeLessThan(0.05)
	})
})
