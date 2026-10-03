import {
	BufferGeometry,
	Mesh,
	MeshStandardMaterial,
	Scene,
	Texture
} from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	collectSceneTextures,
	uploadTexturesInSlices,
	warmUpShaders
} from './shader-warmup'

import type { Camera, Material, WebGLRenderTarget, WebGLRenderer } from 'three'

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

describe('texture uploads during the warm-up', () => {
	/** Tasks the uploader handed back to the browser, run one at a time below. */
	let tasks: Array<() => void>

	beforeEach(() => {
		tasks = []
		vi.stubGlobal('setTimeout', (task: () => void) => tasks.push(task))
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	/** Lets the browser run one task, then everything that task awaited. */
	const runOneTask = async () => {
		tasks.shift()?.()
		for (let i = 0; i < 5; i++) await Promise.resolve()
	}

	const texture = (version = 1) =>
		({ isTexture: true, image: {}, version }) as unknown as Texture

	const uploadingRenderer = (uploadedVersions = new Map<Texture, number>()) => {
		const uploads: Texture[] = []
		const gl = {
			properties: {
				get: (t: Texture) => ({ __version: uploadedVersions.get(t) })
			},
			initTexture: (t: Texture) => uploads.push(t)
		} as unknown as WebGLRenderer
		return { gl, uploads }
	}

	it('collects each texture a scene samples once', () => {
		const map = new Texture()
		const normalMap = new Texture()
		const scene = new Scene()
		scene.add(
			new Mesh(
				new BufferGeometry(),
				new MeshStandardMaterial({ map, normalMap })
			),
			new Mesh(new BufferGeometry(), new MeshStandardMaterial({ map }))
		)
		expect(collectSceneTextures(scene)).toEqual([map, normalMap])
	})

	it('uploads one texture per task, so the browser runs between them', async () => {
		const { gl, uploads } = uploadingRenderer()
		const textures = [texture(), texture(), texture()]

		const uploading = uploadTexturesInSlices(gl, textures, () => false)
		expect(uploads).toHaveLength(0)
		for (const count of [1, 2, 3]) {
			await runOneTask()
			expect(uploads).toHaveLength(count)
		}
		await uploading
		expect(uploads).toEqual(textures)
	})

	it('skips a texture already on the GPU at its current version', async () => {
		const done = texture(3)
		const stale = texture(4)
		const { gl, uploads } = uploadingRenderer(
			new Map([
				[done, 3],
				[stale, 3]
			])
		)

		const uploading = uploadTexturesInSlices(gl, [done, stale], () => false)
		await runOneTask()
		await uploading
		expect(uploads).toEqual([stale])
	})

	it('stops once the warm-up is cancelled', async () => {
		const { gl, uploads } = uploadingRenderer()
		let cancelled = false

		const uploading = uploadTexturesInSlices(
			gl,
			[texture(), texture()],
			() => cancelled
		)
		await runOneTask()
		cancelled = true
		await runOneTask()
		await uploading
		expect(uploads).toHaveLength(1)
	})
})
