/**
 * A texture pass commits a finished result, or nothing.
 *
 * It used to rewrite the live document one texture at a time. A pass that
 * failed partway left that half-done document in place without renaming the
 * textures it had changed or recording that it ran, so a report described no
 * savings for a document that had some; and a pass that a restore or another
 * step overtook kept writing into whichever document it had started on.
 *
 * The encoder below has the surface gltf-transform's `compressTexture` calls -
 * `toFormat`, `resize`, `toBuffer` - and can fail chosen textures, by the order
 * they are encoded in, or be held open so a race can be ordered.
 */
import { Document, WebIO } from '@gltf-transform/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelOptimizer, SupersededError } from './model-optimizer'
import { TextureCompressionError } from './texture-compression'

const io = new WebIO()

const ONE_PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
)

const MATERIALS = ['Wood', 'Metal', 'Glass']

/**
 * One PNG base colour per material, on enough float positions for quantize to
 * shrink, so another step can replace the document while a pass runs.
 */
async function texturedGlb(): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const positions = new Float32Array(300 * 3).map((_, i) => Math.sin(i * 0.37))
	const accessor = document.createAccessor().setType('VEC3').setArray(positions)
	const mesh = document.createMesh()
	for (const name of MATERIALS) {
		const texture = document
			.createTexture()
			.setImage(ONE_PIXEL_PNG.slice())
			.setMimeType('image/png')
		const material = document.createMaterial(name).setBaseColorTexture(texture)
		mesh.addPrimitive(
			document
				.createPrimitive()
				.setAttribute('POSITION', accessor)
				.setMaterial(material)
		)
	}
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return io.writeBinary(document)
}

/** `holdAt` holds that encode, and every later one, until `release`. */
function fakeEncoder({
	failOn = [] as number[],
	holdAt = undefined as number | undefined
} = {}) {
	let calls = 0
	let release: () => void = () => {}
	let reached: () => void = () => {}
	const opened = new Promise<void>((resolve) => (release = resolve))
	const gate = new Promise<void>((resolve) => (reached = resolve))

	const encoder = (_input: Uint8Array) => {
		const call = calls++
		let format = 'png'
		const instance = {
			toFormat(next: string) {
				format = next
				return instance
			},
			resize() {
				return instance
			},
			async toBuffer() {
				if (holdAt !== undefined && call >= holdAt) {
					reached()
					await opened
				}
				if (failOn.includes(call)) throw new Error(`cannot encode #${call}`)
				return new TextEncoder().encode(`${format} ${call}`)
			}
		}
		return instance
	}

	return { encoder, release: () => release(), reached: gate }
}

/**
 * Holds the optimizer's parse of `held` until `release`, so a restore can be
 * left claimed but not committed while the pass finishes.
 */
function holdParse(optimizer: ModelOptimizer, held: Uint8Array) {
	const io = (optimizer as unknown as { io: WebIO }).io
	const readBinary = io.readBinary.bind(io)
	let release: () => void = () => {}
	vi.spyOn(io, 'readBinary').mockImplementation((bytes) =>
		bytes === held
			? new Promise((resolve) => {
					release = () => resolve(readBinary(bytes))
				})
			: readBinary(bytes)
	)
	return { release: () => release() }
}

async function loaded() {
	const optimizer = new ModelOptimizer()
	await optimizer.loadFromBuffer(await texturedGlb())
	return optimizer
}

const textures = (optimizer: ModelOptimizer) =>
	optimizer.document
		.getRoot()
		.listTextures()
		.map((texture) => ({
			mimeType: texture.getMimeType(),
			name: texture.getName()
		}))

const recorded = (optimizer: ModelOptimizer) =>
	optimizer
		.getAppliedOptimizations()
		.filter((name) => name === 'texture compression')

afterEach(() => {
	vi.doUnmock('sharp')
})

describe('ModelOptimizer.compressTextures', () => {
	it('commits and records a pass that compressed every texture, once', async () => {
		const optimizer = await loaded()

		await optimizer.compressTextures({
			encoder: fakeEncoder().encoder,
			targetFormat: 'webp'
		})
		await optimizer.compressTextures({
			encoder: fakeEncoder().encoder,
			targetFormat: 'webp'
		})

		expect(textures(optimizer)).toEqual(
			MATERIALS.map((material) => ({
				mimeType: 'image/webp',
				name: `${material}_baseColor.webp`
			}))
		)
		expect(recorded(optimizer)).toHaveLength(1)
	})

	it('commits, names and records the textures that compressed when others fail', async () => {
		const optimizer = await loaded()

		const pass = optimizer.compressTextures({
			encoder: fakeEncoder({ failOn: [1] }).encoder,
			targetFormat: 'webp'
		})

		const error = await pass.catch((thrown) => thrown)
		expect(error).toBeInstanceOf(TextureCompressionError)
		expect(error.isPartial).toBe(true)
		expect(textures(optimizer)).toEqual([
			{ mimeType: 'image/webp', name: 'Wood_baseColor.webp' },
			{ mimeType: 'image/png', name: 'Metal_baseColor.png' },
			{ mimeType: 'image/webp', name: 'Glass_baseColor.webp' }
		])
		expect(recorded(optimizer)).toHaveLength(1)
	})

	// An export or a save can read the document while a pass runs.
	it('shows nothing of a pass until it is finished', async () => {
		const optimizer = await loaded()
		const held = fakeEncoder({ holdAt: 1 })

		const pass = optimizer.compressTextures({
			encoder: held.encoder,
			targetFormat: 'webp'
		})
		await held.reached

		expect(textures(optimizer).map(({ mimeType }) => mimeType)).toEqual([
			'image/png',
			'image/png',
			'image/png'
		])
		held.release()
		await pass
		expect(textures(optimizer).map(({ mimeType }) => mimeType)).toEqual([
			'image/webp',
			'image/webp',
			'image/webp'
		])
	})

	// The slot is found by identity, so it has to be looked up in the document
	// the texture belongs to, which is the copy the pass committed.
	it('names an unnamed texture after its material slot', async () => {
		const optimizer = await loaded()
		optimizer.document.getRoot().listTextures()[1].setName('').setURI('')

		await optimizer.compressTextures({
			encoder: fakeEncoder().encoder,
			targetFormat: 'webp'
		})

		expect(textures(optimizer)[1].name).toBe('Metal_baseColor.webp')
	})

	it('changes nothing when no texture compressed', async () => {
		const optimizer = await loaded()
		const before = optimizer.document

		const error = await optimizer
			.compressTextures({
				encoder: fakeEncoder({ failOn: [0, 1, 2] }).encoder,
				targetFormat: 'webp'
			})
			.catch((thrown) => thrown)

		expect(error).toBeInstanceOf(TextureCompressionError)
		expect(error.isPartial).toBe(false)
		expect(optimizer.document).toBe(before)
		expect(recorded(optimizer)).toEqual([])
	})

	it('commits nothing into a document restored while it ran', async () => {
		const optimizer = await loaded()
		const held = fakeEncoder({ holdAt: 0 })

		const pass = optimizer.compressTextures({
			encoder: held.encoder,
			targetFormat: 'webp'
		})
		await held.reached
		await optimizer.restoreSource()
		const restored = optimizer.document
		held.release()

		await expect(pass).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.document).toBe(restored)
		expect(textures(optimizer).map(({ mimeType }) => mimeType)).toEqual([
			'image/png',
			'image/png',
			'image/png'
		])
		expect(recorded(optimizer)).toEqual([])
	})

	// Claimed but not yet committed: only the revision says the pass is stale.
	it('commits nothing while a restore it was overtaken by is still parsing', async () => {
		const optimizer = await loaded()
		const held = fakeEncoder({ holdAt: 0 })
		const parse = holdParse(optimizer, optimizer.getBaseline().source!)

		const pass = optimizer.compressTextures({
			encoder: held.encoder,
			targetFormat: 'webp'
		})
		await held.reached
		const restoring = optimizer.restoreSource()
		held.release()

		await expect(pass).rejects.toBeInstanceOf(SupersededError)
		parse.release()
		await restoring
		expect(recorded(optimizer)).toEqual([])
	})

	// Another step can commit a new document without claiming a revision, and
	// committing over it would silently undo that step.
	it('commits nothing over a document another step replaced while it ran', async () => {
		const optimizer = await loaded()
		const held = fakeEncoder({ holdAt: 0 })

		const pass = optimizer.compressTextures({
			encoder: held.encoder,
			targetFormat: 'webp'
		})
		await held.reached
		await optimizer.quantize()
		const quantized = optimizer.document
		expect(optimizer.getAppliedOptimizations()).toContain('quantization')
		held.release()

		await expect(pass).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.document).toBe(quantized)
		expect(recorded(optimizer)).toEqual([])
	})

	it('records only the fallback it ran when there is no encoder at all', async () => {
		vi.doMock('sharp', () => {
			throw new Error('sharp is not installed here')
		})
		const optimizer = await loaded()
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		await optimizer.compressTextures({ targetFormat: 'webp' })

		expect(optimizer.getAppliedOptimizations()).toEqual([
			'basic texture optimization'
		])
	})

	// A reset clears the document, so the fallback found nothing to read and
	// used to report that as done.
	it('refuses the fallback when the model is reset while the encoder is sought', async () => {
		vi.doMock('sharp', () => {
			throw new Error('sharp is not installed here')
		})
		const optimizer = await loaded()
		vi.spyOn(console, 'warn').mockImplementation(() => {})

		const pass = optimizer.compressTextures({ targetFormat: 'webp' })
		optimizer.reset()

		await expect(pass).rejects.toBeInstanceOf(SupersededError)
	})
})
