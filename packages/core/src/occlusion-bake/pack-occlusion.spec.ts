import { Document, ImageUtils, Material, WebIO } from '@gltf-transform/core'
import {
	KHRMaterialsClearcoat,
	KHRTextureTransform
} from '@gltf-transform/extensions'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
	packableMetallicRoughness,
	packOcclusionIntoMetallicRoughness,
	packOcclusionPixels
} from './pack-occlusion'

import type { ImageCodec } from './image-codec'
import type { UvBake } from './uv-trace'

/** The start of a PNG, enough for its size to be read; nothing decodes it. */
function pngHeader(width: number, height: number, bitDepth = 8): Uint8Array {
	const bytes = new Uint8Array(25)
	bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
	const view = new DataView(bytes.buffer)
	view.setUint32(16, width)
	view.setUint32(20, height)
	bytes[24] = bitDepth
	return bytes
}

function materialWithMetallicRoughness(size = 4) {
	const document = new Document()
	document.createBuffer()
	const texture = document
		.createTexture('mr')
		.setImage(pngHeader(size, size))
		.setMimeType('image/png')
	const material = document
		.createMaterial('body')
		.setMetallicRoughnessTexture(texture)
	return { document, material, texture }
}

/** A grey bake of `size` squared, every texel `value`. */
function bakeOf(material: Material, size = 2, value = 64): UvBake {
	const pixels = new Uint8Array(size * size * 4)
	for (let i = 0; i < pixels.length; i += 4) {
		pixels.set([value, value, value, 255], i)
	}
	return { material, size, pixels, texCoord: 0 }
}

describe('packableMetallicRoughness', () => {
	it('takes a texture only this material reads, untransformed, on the bake’s UVs', () => {
		const { material, texture } = materialWithMetallicRoughness()
		expect(packableMetallicRoughness(material, { size: 2 })).toBe(texture)
	})

	it('needs a metallic-roughness texture', () => {
		const material = new Document().createMaterial()
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a bake in a UV set laid out for it', () => {
		const { material } = materialWithMetallicRoughness()
		expect(
			packableMetallicRoughness(material, { size: 2, texCoord: 1 })
		).toBeUndefined()
	})

	it('refuses a texture read from another UV set', () => {
		const { material } = materialWithMetallicRoughness()
		material.getMetallicRoughnessTextureInfo()?.setTexCoord(1)
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a texture read through a transform', () => {
		const { document, material } = materialWithMetallicRoughness()
		const transform = document
			.createExtension(KHRTextureTransform)
			.createTransform()
			.setScale([2, 2])
		material
			.getMetallicRoughnessTextureInfo()
			?.setExtension('KHR_texture_transform', transform)
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a texture another material reads', () => {
		const { document, material, texture } = materialWithMetallicRoughness()
		document.createMaterial('trim').setMetallicRoughnessTexture(texture)
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a texture the same material reads in another slot', () => {
		const { material, texture } = materialWithMetallicRoughness()
		material.setBaseColorTexture(texture)
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a texture an extension of the material reads', () => {
		const { document, material, texture } = materialWithMetallicRoughness()
		const clearcoat = document
			.createExtension(KHRMaterialsClearcoat)
			.createClearcoat()
			.setClearcoatRoughnessTexture(texture)
		material.setExtension('KHR_materials_clearcoat', clearcoat)
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a texture smaller than the bake', () => {
		const { material } = materialWithMetallicRoughness(1)
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses a 16-bit PNG, which a canvas reads back at 8 bits', () => {
		const { material, texture } = materialWithMetallicRoughness()
		texture.setImage(pngHeader(4, 4, 16))
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})

	it('refuses an image a canvas cannot read, such as KTX2', () => {
		const { material, texture } = materialWithMetallicRoughness()
		texture.setMimeType('image/ktx2')
		// Its size readable, so only its type can refuse it.
		const impls = ImageUtils.impls as Record<string, unknown>
		const ktx2 = impls['image/ktx2']
		ImageUtils.registerFormat('image/ktx2', {
			match: () => false,
			getSize: () => [4, 4],
			getChannels: () => 4
		})
		onTestFinished(() => {
			if (ktx2) impls['image/ktx2'] = ktx2
			else delete impls['image/ktx2']
		})
		expect(packableMetallicRoughness(material, { size: 2 })).toBeUndefined()
	})
})

describe('packOcclusionPixels', () => {
	it('writes the bake into red, resampled to the image, and keeps green, blue and alpha', () => {
		// A 2 by 1 image over a 2 by 2 bake: dark left column, open right one.
		const bake = {
			size: 2,
			pixels: Uint8Array.from([
				0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255, 200, 200, 200, 255
			])
		}
		const image = Uint8ClampedArray.from([9, 10, 20, 255, 9, 30, 40, 255])

		expect(Array.from(packOcclusionPixels(image, 2, 1, bake) ?? [])).toEqual([
			0, 10, 20, 255, 200, 30, 40, 255
		])
		// Upsampled, a texel between two bake texels blends them.
		const wide = new Uint8ClampedArray(4 * 4).fill(255)
		const packed = packOcclusionPixels(wide, 4, 1, bake)
		expect([0, 1, 2, 3].map((x) => packed?.[x * 4])).toEqual([0, 50, 150, 200])
	})

	it('lines the bake’s rows and columns up with the image’s, row 0 at the top', () => {
		// Each bake texel distinct, so a flip or a swap of axes shows.
		const bake = {
			size: 2,
			pixels: Uint8Array.from([
				10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255
			])
		}
		const image = new Uint8ClampedArray(2 * 2 * 4).fill(255)

		const packed = packOcclusionPixels(image, 2, 2, bake)

		expect([0, 1, 2, 3].map((i) => packed?.[i * 4])).toEqual([10, 20, 30, 40])
	})

	it('refuses an image that is not fully opaque', () => {
		const image = Uint8ClampedArray.from([0, 10, 20, 254])
		expect(
			packOcclusionPixels(image, 1, 1, { size: 1, pixels: new Uint8Array(4) })
		).toBeUndefined()
	})
})

describe('packOcclusionIntoMetallicRoughness', () => {
	/** Decodes to opaque grey of the given size; encodes to `encoded` bytes. */
	function codecOf(size: number, encoded: number | undefined): ImageCodec {
		return {
			decode: vi.fn(async () => ({
				width: size,
				height: size,
				pixels: new Uint8ClampedArray(size * size * 4).fill(255)
			})),
			encode: vi.fn(async (pixels: Uint8ClampedArray) =>
				encoded === undefined
					? undefined
					: Uint8Array.from({ length: encoded }, (_, i) => pixels[i % 4])
			)
		}
	}

	it('stores the bake in the texture’s red channel and reads occlusion from it', async () => {
		const { document, material, texture } = materialWithMetallicRoughness()
		material
			.getMetallicRoughnessTextureInfo()
			?.setWrapS(33071)
			.setMagFilter(9728)
		const codec = codecOf(4, 10)

		const packed = await packOcclusionIntoMetallicRoughness(
			bakeOf(material),
			new Uint8Array(100),
			codec
		)

		expect(packed).toBe(true)
		const [pixels, , , mimeType] = vi.mocked(codec.encode).mock.calls[0]
		expect(pixels[0]).toBe(64)
		expect(mimeType).toBe('image/png')
		expect(texture.getImage()?.byteLength).toBe(10)
		expect(material.getOcclusionTexture()).toBe(texture)
		expect(material.getOcclusionStrength()).toBe(1)
		const info = material.getOcclusionTextureInfo()
		expect(info?.getTexCoord()).toBe(0)
		expect(info?.getWrapS()).toBe(33071)
		expect(info?.getMagFilter()).toBe(9728)

		// One image in the file, read by both slots.
		const io = new WebIO()
		const reread = await io.readBinary(await io.writeBinary(document))
		const [stored] = reread.getRoot().listMaterials()
		expect(reread.getRoot().listTextures()).toHaveLength(1)
		expect(stored.getOcclusionTexture()).toBe(
			stored.getMetallicRoughnessTexture()
		)
	})

	it.each([
		['in a GLB, with no file name', undefined, ''],
		[
			'with a file name, renamed to match',
			'textures/mr.webp',
			'textures/mr.png'
		]
	])(
		'writes a lossy texture back as PNG, %s, so red never bleeds into green and blue',
		async (_, uri, renamed) => {
			const { material, texture } = materialWithMetallicRoughness()
			texture.setMimeType('image/webp')
			if (uri) texture.setURI(uri)
			const codec = codecOf(4, 10)
			// Its size readable, as the WebP extension makes it in the app.
			vi.spyOn(texture, 'getSize').mockReturnValue([4, 4])

			const packed = await packOcclusionIntoMetallicRoughness(
				bakeOf(material),
				new Uint8Array(100),
				codec
			)

			expect(packed).toBe(true)
			expect(vi.mocked(codec.decode).mock.calls[0][1]).toBe('image/webp')
			expect(vi.mocked(codec.encode).mock.calls[0][3]).toBe('image/png')
			expect(texture.getMimeType()).toBe('image/png')
			expect(texture.getURI()).toBe(renamed)
		}
	)

	it('keeps them apart when the packed image is larger than the two it replaces', async () => {
		const { material, texture } = materialWithMetallicRoughness()
		const before = texture.getImage()

		const packed = await packOcclusionIntoMetallicRoughness(
			bakeOf(material),
			new Uint8Array(1),
			codecOf(4, 27)
		)

		expect(packed).toBe(false)
		expect(texture.getImage()).toBe(before)
		expect(material.getOcclusionTexture()).toBeNull()
	})

	it('keeps them apart when the browser cannot write the image’s type', async () => {
		const { material } = materialWithMetallicRoughness()

		const packed = await packOcclusionIntoMetallicRoughness(
			bakeOf(material),
			new Uint8Array(100),
			codecOf(4, undefined)
		)

		expect(packed).toBe(false)
		expect(material.getOcclusionTexture()).toBeNull()
	})

	it('decodes nothing for a material it cannot pack', async () => {
		const material = new Document().createMaterial()
		const codec = codecOf(4, 10)

		expect(
			await packOcclusionIntoMetallicRoughness(
				bakeOf(material),
				new Uint8Array(100),
				codec
			)
		).toBe(false)
		expect(codec.decode).not.toHaveBeenCalled()
	})
})
