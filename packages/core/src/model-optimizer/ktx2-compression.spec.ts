import { Document, WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { describe, expect, it, vi } from 'vitest'

import {
	basisOptionsForSlots,
	compressTexturesToKtx2,
	KTX2_MAX_GROWTH,
	ktx2EncodeSize
} from './ktx2-compression'

// Image sizes are read by formats an I/O registers, as the document's reader
// will have done before any texture reaches the encoder.
const io = new WebIO().registerExtensions(ALL_EXTENSIONS)

/** The header of a lossless WebP of the given size, enough to be measured. */
function webpHeader(
	width: number,
	height: number,
	byteLength = 64
): Uint8Array {
	const bytes = new Uint8Array(byteLength)
	const view = new DataView(bytes.buffer)
	bytes.set(new TextEncoder().encode('RIFF'), 0)
	view.setUint32(4, byteLength - 8, true)
	bytes.set(new TextEncoder().encode('WEBPVP8L'), 8)
	view.setUint32(16, byteLength - 20, true)
	bytes[20] = 0x2f
	view.setUint32(21, (width - 1) | ((height - 1) << 14), true)
	return bytes
}

function texturedDocument(): Document {
	const document = new Document()
	document.createBuffer()
	document.createExtension(EXTTextureWebP)
	const color = document
		.createTexture('color')
		.setImage(webpHeader(1024, 512))
		.setMimeType('image/webp')
		.setURI('color.webp')
	const normal = document
		.createTexture('normal')
		.setImage(webpHeader(4096, 4096))
		.setMimeType('image/webp')
	document.createMaterial().setBaseColorTexture(color).setNormalTexture(normal)
	return document
}

const ktx2Bytes = () => new Uint8Array([0xab, 0x4b, 0x54, 0x58])

describe('basisOptionsForSlots', () => {
	it('encodes colour as perceptual sRGB ETC1S', () => {
		for (const slots of [['baseColorTexture'], ['emissiveTexture']]) {
			expect(basisOptionsForSlots(slots)).toEqual({
				isUASTC: false,
				isPerceptual: true,
				isSetKTX2SRGBTransferFunc: true,
				generateMipmap: true
			})
		}
	})

	it('encodes data maps as linear, supercompressed UASTC', () => {
		expect(basisOptionsForSlots(['metallicRoughnessTexture'])).toEqual({
			isUASTC: true,
			isPerceptual: false,
			isSetKTX2SRGBTransferFunc: false,
			needSupercompression: true,
			enableRDO: true,
			rdoQualityLevel: 4,
			uastcLDRQualityLevel: 0,
			generateMipmap: true
		})
	})

	it('tunes normal maps for normals', () => {
		const normal = basisOptionsForSlots(['normalTexture'])
		expect(normal).toMatchObject({ isUASTC: true, isNormalMap: true })
		expect(normal).not.toHaveProperty('rdoQualityLevel')
		expect(basisOptionsForSlots(['occlusionTexture'])).not.toHaveProperty(
			'isNormalMap'
		)
	})

	it('treats a texture shared by colour and data as data', () => {
		expect(
			basisOptionsForSlots(['baseColorTexture', 'occlusionTexture'])
		).toMatchObject({ isUASTC: true, isSetKTX2SRGBTransferFunc: false })
	})
})

describe('ktx2EncodeSize', () => {
	it('keeps a size already in whole blocks and within the limit', () => {
		expect(ktx2EncodeSize([1024, 512])).toEqual([1024, 512])
	})

	it('scales down to 2048 on the long edge, keeping the aspect', () => {
		expect(ktx2EncodeSize([4096, 4096])).toEqual([2048, 2048])
		expect(ktx2EncodeSize([8192, 2048])).toEqual([2048, 512])
	})

	it('rounds to whole 4×4 blocks, never below one', () => {
		expect(ktx2EncodeSize([1023, 513])).toEqual([1024, 512])
		expect(ktx2EncodeSize([1, 3])).toEqual([4, 4])
	})
})

describe('compressTexturesToKtx2', () => {
	it('encodes each texture with its slots’ options at its encode size', async () => {
		const document = texturedDocument()
		const encode = vi.fn(async () => ktx2Bytes())

		const report = await compressTexturesToKtx2(document, { encode })

		expect(report).toEqual({ encoded: ['color', 'normal'], kept: [] })
		expect(encode).toHaveBeenCalledWith(
			expect.objectContaining({ width: 1024, height: 512 }),
			expect.objectContaining({ isUASTC: false })
		)
		expect(encode).toHaveBeenCalledWith(
			expect.objectContaining({ width: 2048, height: 2048 }),
			expect.objectContaining({ isUASTC: true, isNormalMap: true })
		)

		const [color] = document.getRoot().listTextures()
		expect(color.getMimeType()).toBe('image/ktx2')
		expect(color.getURI()).toBe('color.ktx2')

		const bytes = await io.writeBinary(document)
		const json = new TextDecoder().decode(bytes)
		expect(json).toContain('"extensionsRequired":["KHR_texture_basisu"]')
		expect(json).not.toContain('EXT_texture_webp')
	})

	it('keeps the WebP sources, and their extension, when the encoder fails', async () => {
		const document = texturedDocument()
		const report = await compressTexturesToKtx2(document, {
			encode: async () => {
				throw new Error('Failed to fetch basis_encoder.wasm: 503')
			}
		})

		expect(report.encoded).toEqual([])
		expect(report.kept).toEqual([
			{ texture: 'color', reason: 'Failed to fetch basis_encoder.wasm: 503' },
			{ texture: 'normal', reason: 'Failed to fetch basis_encoder.wasm: 503' }
		])
		expect(
			document
				.getRoot()
				.listTextures()
				.map((texture) => texture.getMimeType())
		).toEqual(['image/webp', 'image/webp'])

		const json = new TextDecoder().decode(await io.writeBinary(document))
		expect(json).toContain('EXT_texture_webp')
		expect(json).not.toContain('KHR_texture_basisu')
	})

	it(`keeps a source when KTX2 would be more than ${KTX2_MAX_GROWTH}× its size`, async () => {
		const document = texturedDocument()
		const report = await compressTexturesToKtx2(document, {
			encode: async ({ image }) =>
				new Uint8Array(image.byteLength * KTX2_MAX_GROWTH + 1)
		})

		expect(report.encoded).toEqual([])
		expect(report.kept).toHaveLength(2)
	})

	it('keeps a texture whose size cannot be read, without encoding it', async () => {
		const document = new Document()
		document
			.createTexture('broken')
			.setImage(new Uint8Array(16))
			.setMimeType('image/png')
		const encode = vi.fn(async () => ktx2Bytes())

		const report = await compressTexturesToKtx2(document, { encode })

		expect(encode).not.toHaveBeenCalled()
		expect(report.kept).toEqual([
			{ texture: 'broken', reason: 'its size could not be read' }
		])
	})

	it('reports progress per texture', async () => {
		const onProgress = vi.fn()
		await compressTexturesToKtx2(texturedDocument(), {
			encode: async () => ktx2Bytes(),
			onProgress
		})
		expect(onProgress.mock.calls).toEqual([
			[0, 2],
			[1, 2],
			[2, 2]
		])
	})

	it('encodes up to `concurrency` textures at once', async () => {
		const document = texturedDocument()
		document
			.createTexture('roughness')
			.setImage(webpHeader(256, 256))
			.setMimeType('image/webp')
		let running = 0
		let mostAtOnce = 0
		const encode = vi.fn(async () => {
			mostAtOnce = Math.max(mostAtOnce, ++running)
			await new Promise((resolve) => setTimeout(resolve))
			running--
			return ktx2Bytes()
		})

		const report = await compressTexturesToKtx2(document, {
			encode,
			concurrency: 2
		})

		expect(encode).toHaveBeenCalledTimes(3)
		expect(mostAtOnce).toBe(2)
		expect(report.encoded).toEqual(['color', 'normal', 'roughness'])
	})

	it('reports in document order however the encodes finish', async () => {
		const document = texturedDocument()
		// The first texture finishes last.
		const encode = vi.fn(async ({ width }: { width: number }) => {
			if (width === 1024) await new Promise((resolve) => setTimeout(resolve, 5))
			else throw new Error('too large')
			return ktx2Bytes()
		})
		const onProgress = vi.fn()

		const report = await compressTexturesToKtx2(document, {
			encode,
			concurrency: 2,
			onProgress
		})

		expect(report).toEqual({
			encoded: ['color'],
			kept: [{ texture: 'normal', reason: 'too large' }]
		})
		expect(onProgress.mock.calls).toEqual([
			[0, 2],
			[1, 2],
			[2, 2]
		])
	})
})
