/**
 * Reading and replacing a texture by index, and the name it is given back.
 *
 * A texture keeps a stable name of its own; failing that it is named after its
 * material slot, and failing that after its position. Whichever wins carries
 * the extension of the texture's current MIME type.
 */
import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'

const ONE_PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
)

const WEBP_BYTES = new TextEncoder().encode('webp bytes')

/** Wood and Metal each use a texture; the third texture is on no material. */
async function loaded() {
	const document = new Document()
	document.createBuffer()
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
	const mesh = document.createMesh()
	for (const name of ['Wood', 'Metal']) {
		const texture = document
			.createTexture()
			.setImage(ONE_PIXEL_PNG.slice())
			.setMimeType('image/png')
		const material = document.createMaterial(name).setBaseColorTexture(texture)
		mesh.addPrimitive(
			document
				.createPrimitive()
				.setAttribute('POSITION', position)
				.setMaterial(material)
		)
	}
	document
		.createTexture()
		.setImage(ONE_PIXEL_PNG.slice())
		.setMimeType('image/png')
	document.createScene().addChild(document.createNode().setMesh(mesh))

	const optimizer = new ModelOptimizer()
	await optimizer.loadFromBuffer(await new WebIO().writeBinary(document))
	return optimizer
}

const names = (optimizer: ModelOptimizer) =>
	optimizer.document
		.getRoot()
		.listTextures()
		.map((texture) => [texture.getName(), texture.getURI()])

describe('ModelOptimizer texture payloads', () => {
	it('lists every texture under its canonical name', async () => {
		const optimizer = await loaded()

		expect(optimizer.listTextureDescriptors()).toEqual([
			{
				index: 0,
				fileName: 'Wood_baseColor.png',
				name: 'Wood_baseColor.png',
				mimeType: 'image/png',
				byteLength: ONE_PIXEL_PNG.byteLength
			},
			{
				index: 1,
				fileName: 'Metal_baseColor.png',
				name: 'Metal_baseColor.png',
				mimeType: 'image/png',
				byteLength: ONE_PIXEL_PNG.byteLength
			},
			{
				index: 2,
				fileName: 'texture-2.png',
				name: 'texture-2.png',
				mimeType: 'image/png',
				byteLength: ONE_PIXEL_PNG.byteLength
			}
		])
	})

	it('returns a texture with its bytes', async () => {
		const optimizer = await loaded()

		expect(optimizer.getTexturePayload(1)).toEqual({
			index: 1,
			fileName: 'Metal_baseColor.png',
			name: 'Metal_baseColor.png',
			mimeType: 'image/png',
			image: ONE_PIXEL_PNG
		})
	})

	it('refuses a texture that is missing or has no bytes', async () => {
		const optimizer = await loaded()
		optimizer.document.getRoot().listTextures()[0].setImage(new Uint8Array())

		expect(() => optimizer.getTexturePayload(3)).toThrow(
			'Texture not found for index 3'
		)
		expect(() => optimizer.getTexturePayload(0)).toThrow(
			'Texture at index 0 has no image payload'
		)
		expect(() =>
			optimizer.replaceTexturePayload(3, WEBP_BYTES, 'image/webp')
		).toThrow('Texture not found for index 3')
	})

	it('names a replaced texture after the file it came from', async () => {
		const optimizer = await loaded()

		optimizer.replaceTexturePayload(
			0,
			WEBP_BYTES,
			'image/webp',
			'textures/oak planks.webp'
		)

		expect(optimizer.getTexturePayload(0)).toMatchObject({
			name: 'oak planks.webp',
			mimeType: 'image/webp',
			image: WEBP_BYTES
		})
		expect(names(optimizer)[0]).toEqual(['oak planks.webp', 'oak planks.webp'])
	})

	// A generic name says nothing a slot or position would not say better.
	it('keeps the name it has over a generic file name', async () => {
		const optimizer = await loaded()

		optimizer.replaceTexturePayload(1, WEBP_BYTES, 'image/webp', 'image_7.png')
		optimizer.replaceTexturePayload(2, WEBP_BYTES, 'image/webp', 'texture-9')

		expect(names(optimizer).slice(1)).toEqual([
			['Metal_baseColor.webp', 'Metal_baseColor.webp'],
			['texture-2.webp', 'texture-2.webp']
		])
	})

	it('names a texture that lost its name after its slot, then its position', async () => {
		const optimizer = await loaded()
		for (const texture of optimizer.document.getRoot().listTextures()) {
			texture.setName('').setURI('')
		}

		optimizer.replaceTexturePayload(1, WEBP_BYTES, 'image/jpeg')
		optimizer.replaceTexturePayload(2, WEBP_BYTES, 'image/jpeg')

		expect(names(optimizer).slice(1)).toEqual([
			['Metal_baseColor.jpg', 'Metal_baseColor.jpg'],
			['texture-2.jpg', 'texture-2.jpg']
		])
	})
})
