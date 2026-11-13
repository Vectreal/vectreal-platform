/**
 * A stage's programs are compiled ahead, in the state each pass draws in, and
 * the stage waits for the driver without blocking on it: a program is asked
 * whether it is ready, never made to finish.
 */
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { warmPrograms, withMaterial } from './warm-programs'

/** A renderer whose programs finish when the test says so. */
function fakeRenderer(programCount: number) {
	const state: (boolean | null)[] = Array(programCount).fill(false)
	let target: THREE.WebGLRenderTarget | null = null
	const compiledInto: (THREE.WebGLRenderTarget | null)[] = []
	const renderer = {
		getRenderTarget: () => target,
		setRenderTarget: (t: THREE.WebGLRenderTarget | null) => {
			target = t
		},
		compile: vi.fn(() => {
			compiledInto.push(target)
			return new Set()
		}),
		info: { programs: state.map((_, i) => ({ isReady: () => state[i] })) }
	}
	return {
		renderer: renderer as unknown as THREE.WebGLRenderer,
		compile: renderer.compile,
		compiledInto,
		finish: (i: number) => (state[i] = true),
		lose: (i: number) => (state[i] = null)
	}
}

const settle = async () => {
	await vi.advanceTimersByTimeAsync(100)
}

describe('warmPrograms', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('waits until every program reports ready, however many one material needed', async () => {
		const { renderer, finish } = fakeRenderer(2)
		let done = false
		void warmPrograms(renderer, new THREE.Object3D(), new THREE.Camera()).then(
			() => (done = true)
		)

		finish(1)
		await settle()
		expect(done).toBe(false)

		finish(0)
		await settle()
		expect(done).toBe(true)
	})

	it('treats a program whose context is gone as done, so a torn-down stage does not wait forever', async () => {
		const { renderer, lose } = fakeRenderer(1)
		let done = false
		void warmPrograms(renderer, new THREE.Object3D(), new THREE.Camera()).then(
			() => (done = true)
		)
		lose(0)
		await settle()
		expect(done).toBe(true)
	})

	it('stops waiting in a hidden tab, whose timers the browser throttles to once a second or less', async () => {
		vi.stubGlobal('document', { hidden: true })
		try {
			const { renderer } = fakeRenderer(1)
			let done = false
			void warmPrograms(
				renderer,
				new THREE.Object3D(),
				new THREE.Camera()
			).then(() => (done = true))
			await Promise.resolve()
			expect(done).toBe(true)
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it('compiles into the canvas or an off-screen target, as the pass draws, and leaves the renderer where it was', async () => {
		const { renderer, compiledInto } = fakeRenderer(0)
		const previous = new THREE.WebGLRenderTarget(1, 1)
		renderer.setRenderTarget(previous)

		await warmPrograms(renderer, new THREE.Object3D(), new THREE.Camera())
		await warmPrograms(renderer, new THREE.Object3D(), new THREE.Camera(), {
			offscreen: true
		})

		expect(compiledInto[0]).toBeNull()
		expect(compiledInto[1]).toBeInstanceOf(THREE.WebGLRenderTarget)
		expect(compiledInto[1]).not.toBe(previous)
		expect(renderer.getRenderTarget()).toBe(previous)
	})

	it('compiles with the lights of the scene the pass draws in', async () => {
		const { renderer, compile } = fakeRenderer(0)
		const object = new THREE.Object3D()
		const camera = new THREE.Camera()
		const scene = new THREE.Scene()
		await warmPrograms(renderer, object, camera, { lightsFrom: scene })
		expect(compile).toHaveBeenCalledWith(object, camera, scene)
	})
})

describe('withMaterial', () => {
	it('copies every mesh with the override material, sharing geometry and leaving the model untouched', () => {
		const geometry = new THREE.BoxGeometry()
		const own = new THREE.MeshStandardMaterial()
		const model = new THREE.Group()
		const child = new THREE.Mesh(geometry, own)
		child.add(new THREE.Mesh(geometry, own))
		model.add(child, new THREE.Object3D())
		const override = new THREE.MeshNormalMaterial()

		const copy = withMaterial(model, override)

		expect(copy.children).toHaveLength(2)
		for (const mesh of copy.children as THREE.Mesh[]) {
			expect(mesh.material).toBe(override)
			expect(mesh.geometry).toBe(geometry)
		}
		expect(child.material).toBe(own)
	})
})
