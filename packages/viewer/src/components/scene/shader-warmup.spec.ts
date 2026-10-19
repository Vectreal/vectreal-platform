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
	warmUpScene,
	warmUpShaders
} from './shader-warmup'

import type { Camera, Material, WebGLRenderTarget, WebGLRenderer } from 'three'

const composerBuffer = {
	name: 'composer input'
} as unknown as WebGLRenderTarget
const historyBuffer = {
	name: 'history'
} as unknown as WebGLRenderTarget

/**
 * A renderer whose `compile` records the target bound at the time, as three
 * keys programs on it, and whose programs report ready only when told to.
 * A program is per material and target, as in three: compiling one material
 * for two targets leaves it two programs, and `currentProgram` the last.
 */
const fakeRenderer = (materialCount = 1) => {
	let bound: WebGLRenderTarget | null = null
	const compiledFor: Array<WebGLRenderTarget | null> = []
	const materials = Array.from(
		{ length: materialCount },
		(_, index) => ({ id: index }) as unknown as Material
	)
	const ready = new Set<string>()
	const live: Array<{ isReady: () => boolean }> = []
	const keyOf = (material: Material, target: WebGLRenderTarget | null) =>
		`${materials.indexOf(material)}:${(target as { name?: string } | null)?.name ?? 'canvas'}`
	const properties = new Map(
		materials.map((material) => [
			material,
			{} as { currentProgram?: { isReady: () => boolean } }
		])
	)
	const gl = {
		getRenderTarget: () => bound,
		setRenderTarget: (target: WebGLRenderTarget | null) => {
			bound = target
		},
		compile: () => {
			compiledFor.push(bound)
			for (const material of materials) {
				const key = keyOf(material, bound)
				const entry = properties.get(material)
				if (!entry) continue
				entry.currentProgram = { isReady: () => ready.has(key) }
				live.push(entry.currentProgram)
			}
			return new Set(materials)
		},
		info: { programs: live },
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
		finish: (material: Material, target: WebGLRenderTarget | null = null) =>
			ready.add(keyOf(material, target)),
		dispose: (material: Material) => properties.delete(material),
		/** Disposed and drawn again: a fresh entry, its old program deleted. */
		reuse: (material: Material) => {
			const old = properties.get(material)?.currentProgram
			live.splice(live.indexOf(old!), 1)
			properties.set(material, {
				currentProgram: { isReady: () => false }
			})
		}
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
		void warmUpShaders(renderer.gl, [{ scene, camera, target: composerBuffer }])
		expect(renderer.compiledFor).toEqual([composerBuffer])
	})

	it('gives the target back before the programs finish', () => {
		const renderer = fakeRenderer()
		void warmUpShaders(renderer.gl, [{ scene, camera, target: composerBuffer }])
		expect(renderer.bound()).toBeNull()
	})

	it('waits for every program, not the first', async () => {
		const renderer = fakeRenderer(2)
		const warming = warmUpShaders(renderer.gl, [
			{ scene, camera, target: null }
		])
		renderer.finish(renderer.materials[0])
		expect(await settles(warming)).toBe(false)
		renderer.finish(renderer.materials[1])
		expect(await settles(warming)).toBe(true)
	})

	it('compiles every draw, each for its own target', () => {
		const renderer = fakeRenderer()
		void warmUpShaders(renderer.gl, [
			{ scene, camera, target: composerBuffer },
			{ scene, camera, target: historyBuffer },
			{ scene, camera, target: null }
		])
		expect(renderer.compiledFor).toEqual([composerBuffer, historyBuffer, null])
		expect(renderer.bound()).toBeNull()
	})

	it("waits for each target's program of one material, not only the last", async () => {
		const renderer = fakeRenderer()
		const [material] = renderer.materials
		const warming = warmUpShaders(renderer.gl, [
			{ scene, camera, target: historyBuffer },
			{ scene, camera, target: null }
		])
		renderer.finish(material, null)
		expect(await settles(warming)).toBe(false)
		renderer.finish(material, historyBuffer)
		expect(await settles(warming)).toBe(true)
	})

	it('settles when a material is disposed and drawn again while it waits', async () => {
		const renderer = fakeRenderer()
		const warming = warmUpShaders(renderer.gl, [
			{ scene, camera, target: null }
		])
		renderer.reuse(renderer.materials[0])
		expect(await settles(warming)).toBe(true)
	})

	it('settles when a material is disposed while it waits', async () => {
		const renderer = fakeRenderer()
		const warming = warmUpShaders(renderer.gl, [
			{ scene, camera, target: null }
		])
		renderer.dispose(renderer.materials[0])
		expect(await settles(warming)).toBe(true)
	})
})

describe('warmUpScene', () => {
	it('settles when the context is lost mid-compile, so the viewer still draws', async () => {
		const renderer = fakeRenderer()
		const gl = {
			...renderer.gl,
			compile: () => {
				throw new TypeError('context lost')
			}
		} as unknown as WebGLRenderer

		await expect(
			warmUpScene(
				gl,
				[{ scene: new Scene(), camera, target: null }],
				() => false
			)
		).resolves.toBeUndefined()
		expect(renderer.bound()).toBeNull()
	})
})

describe('texture uploads during the warm-up', () => {
	/** Tasks the uploader handed back to the browser, run one at a time below. */
	let tasks: Array<() => void>
	/** The clock the uploader budgets against; each upload advances it. */
	let now: number

	beforeEach(() => {
		tasks = []
		now = 0
		vi.stubGlobal('setTimeout', (task: () => void) => tasks.push(task))
		vi.spyOn(performance, 'now').mockImplementation(() => now)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	/** Lets the browser run one task, then everything that task awaited. */
	const runOneTask = async () => {
		tasks.shift()?.()
		for (let i = 0; i < 5; i++) await Promise.resolve()
	}

	const texture = (version = 1) =>
		({ isTexture: true, image: {}, version }) as unknown as Texture

	const uploadingRenderer = (
		uploadedVersions = new Map<Texture, number>(),
		uploadMs = 10
	) => {
		const uploads: Texture[] = []
		const gl = {
			properties: {
				get: (t: Texture) => ({ __version: uploadedVersions.get(t) })
			},
			initTexture: (t: Texture) => {
				uploads.push(t)
				now += uploadMs
			}
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

	it('shares a task between uploads that fit in one slice', async () => {
		const { gl, uploads } = uploadingRenderer(new Map(), 2)
		const textures = [texture(), texture(), texture(), texture(), texture()]

		const uploading = uploadTexturesInSlices(gl, textures, () => false)
		expect(uploads).toHaveLength(0)
		await runOneTask()
		expect(uploads).toHaveLength(4)
		await runOneTask()
		await uploading
		expect(uploads).toEqual(textures)
	})

	it('gives a slow upload a task of its own, so the browser runs between them', async () => {
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
