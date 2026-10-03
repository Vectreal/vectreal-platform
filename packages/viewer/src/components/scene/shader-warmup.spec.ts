import { describe, expect, it } from 'vitest'

import { warmUpShaders } from './shader-warmup'

import type { Camera, Scene, WebGLRenderTarget, WebGLRenderer } from 'three'

const canvasTarget = null
const composerBuffer = {
	name: 'composer input'
} as unknown as WebGLRenderTarget

/** Records the target bound at each call, as three would key programs on it. */
const fakeRenderer = (compile: () => Promise<unknown>) => {
	let bound: WebGLRenderTarget | null = canvasTarget
	const compiledFor: Array<WebGLRenderTarget | null> = []
	const gl = {
		getRenderTarget: () => bound,
		setRenderTarget: (target: WebGLRenderTarget | null) => {
			bound = target
		},
		compileAsync: () => {
			compiledFor.push(bound)
			return compile()
		}
	} as unknown as WebGLRenderer
	return { gl, compiledFor, bound: () => bound }
}

const scene = {} as Scene
const camera = {} as Camera

describe('warmUpShaders', () => {
	it('compiles for the target the scene will be drawn into', async () => {
		const renderer = fakeRenderer(() => Promise.resolve())
		await warmUpShaders(renderer.gl, scene, camera, composerBuffer)
		expect(renderer.compiledFor).toEqual([composerBuffer])
	})

	it('gives the target back before the compile finishes', () => {
		const renderer = fakeRenderer(() => new Promise(() => {}))
		void warmUpShaders(renderer.gl, scene, camera, composerBuffer)
		expect(renderer.bound()).toBe(canvasTarget)
	})

	it('resolves only once the compile does', async () => {
		let finish = () => {}
		const renderer = fakeRenderer(
			() => new Promise<void>((resolve) => (finish = resolve))
		)
		let warmed = false
		const warming = warmUpShaders(renderer.gl, scene, camera, null).then(
			() => (warmed = true)
		)
		await Promise.resolve()
		expect(warmed).toBe(false)
		finish()
		await warming
		expect(warmed).toBe(true)
	})
})
