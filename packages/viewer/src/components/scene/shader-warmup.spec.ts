import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { warmUpShaders } from './shader-warmup'

import type {
	Camera,
	Material,
	Scene,
	WebGLRenderTarget,
	WebGLRenderer
} from 'three'

const composerBuffer = {
	name: 'composer input'
} as unknown as WebGLRenderTarget

/**
 * A renderer whose `compile` records the target bound at the time, as three
 * keys programs on it, and whose programs report ready only when told to.
 */
const fakeRenderer = (materialCount = 1) => {
	let bound: WebGLRenderTarget | null = null
	const compiledFor: Array<WebGLRenderTarget | null> = []
	const materials = Array.from(
		{ length: materialCount },
		(_, index) => ({ id: index }) as unknown as Material
	)
	const ready = new Map(materials.map((material) => [material, false]))
	const properties = new Map(
		materials.map((material) => [
			material,
			{ currentProgram: { isReady: () => ready.get(material) } }
		])
	)
	const gl = {
		getRenderTarget: () => bound,
		setRenderTarget: (target: WebGLRenderTarget | null) => {
			bound = target
		},
		compile: () => {
			compiledFor.push(bound)
			return new Set(materials)
		},
		properties: {
			has: (material: Material) => properties.has(material),
			get: (material: Material) => properties.get(material)
		}
	} as unknown as WebGLRenderer
	return {
		gl,
		materials,
		compiledFor,
		bound: () => bound,
		finish: (material: Material) => ready.set(material, true),
		dispose: (material: Material) => properties.delete(material)
	}
}

const scene = {} as Scene
const camera = {} as Camera

const settles = async (warming: Promise<void>) => {
	let settled = false
	void warming.then(() => (settled = true))
	await vi.advanceTimersByTimeAsync(50)
	return settled
}

describe('warmUpShaders', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('compiles for the target the scene will be drawn into', () => {
		const renderer = fakeRenderer()
		void warmUpShaders(renderer.gl, scene, camera, composerBuffer)
		expect(renderer.compiledFor).toEqual([composerBuffer])
	})

	it('gives the target back before the programs finish', () => {
		const renderer = fakeRenderer()
		void warmUpShaders(renderer.gl, scene, camera, composerBuffer)
		expect(renderer.bound()).toBeNull()
	})

	it('waits for every program, not the first', async () => {
		const renderer = fakeRenderer(2)
		const warming = warmUpShaders(renderer.gl, scene, camera, null)
		renderer.finish(renderer.materials[0])
		expect(await settles(warming)).toBe(false)
		renderer.finish(renderer.materials[1])
		expect(await settles(warming)).toBe(true)
	})

	it('settles when a material is disposed while it waits', async () => {
		const renderer = fakeRenderer()
		const warming = warmUpShaders(renderer.gl, scene, camera, null)
		renderer.dispose(renderer.materials[0])
		expect(await settles(warming)).toBe(true)
	})
})
