import { Document, type Material } from '@gltf-transform/core'
import { EXTTextureWebP } from '@gltf-transform/extensions'
import { describe, expect, it, vi } from 'vitest'

import { bakeOcclusionIntoDocument } from './bake-into-document'

import type { OcclusionBakePlan } from './plan'

// The GPU bake and the canvas stand in: the first is a grey map per target,
// the second decodes to an opaque 4 by 4 image and encodes to 8 bytes.
vi.mock('./bake-occlusion', () => ({
	bakeOcclusion: vi.fn(async ({ targets }: OcclusionBakePlan) =>
		targets.map(({ material, texCoord }) => ({
			material,
			size: 2,
			pixels: new Uint8Array(16).fill(128),
			texCoord
		}))
	),
	encodeOcclusionPng: vi.fn(async () => new Uint8Array(64))
}))
vi.mock('./image-codec', () => ({
	browserImageCodec: {
		decode: async () => ({
			width: 4,
			height: 4,
			pixels: new Uint8ClampedArray(64).fill(255)
		}),
		encode: async () => new Uint8Array(8)
	}
}))

/** A one-triangle scene drawn with `material`, its UVs inside the unit square. */
function sceneDrawing(document: Document, material: Material) {
	const primitive = document
		.createPrimitive()
		.setMaterial(material)
		.setAttribute(
			'POSITION',
			document
				.createAccessor()
				.setType('VEC3')
				.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
		)
		.setAttribute(
			'TEXCOORD_0',
			document
				.createAccessor()
				.setType('VEC2')
				.setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
		)
	document
		.createScene()
		.addChild(
			document
				.createNode()
				.setMesh(document.createMesh().addPrimitive(primitive))
		)
}

/** The start of an 8-bit 4 by 4 PNG, enough for its size and depth to be read. */
const PNG_4 = Uint8Array.from([
	137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 4, 0,
	0, 0, 4, 8
])

describe('bakeOcclusionIntoDocument', () => {
	it('asks for no renderer when nothing can be baked, and says why', async () => {
		const document = new Document()
		const primitive = document
			.createPrimitive()
			.setMaterial(document.createMaterial('plain'))
			.setAttribute(
				'POSITION',
				document
					.createAccessor()
					.setType('VEC3')
					.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
			)
		document
			.createScene()
			.addChild(
				document
					.createNode()
					.setMesh(document.createMesh().addPrimitive(primitive))
			)
		const renderer = vi.fn()

		const report = await bakeOcclusionIntoDocument(document, renderer)

		expect(renderer).not.toHaveBeenCalled()
		expect(report).toEqual({
			baked: [],
			skipped: [{ material: 'plain', reason: 'no-uv0' }]
		})
	})

	it('packs the bake into the metallic-roughness texture when it can, adding no texture', async () => {
		const document = new Document()
		const metallicRoughness = document
			.createTexture('mr')
			.setImage(PNG_4)
			.setMimeType('image/png')
		const body = document
			.createMaterial('body')
			.setMetallicRoughnessTexture(metallicRoughness)
		sceneDrawing(document, body)

		const report = await bakeOcclusionIntoDocument(document, vi.fn())

		expect(report.baked).toEqual(['body'])
		expect(body.getOcclusionTexture()).toBe(metallicRoughness)
		expect(document.getRoot().listTextures()).toHaveLength(1)
	})

	it('drops EXT_texture_webp once packing leaves no WebP texture', async () => {
		const document = new Document()
		document.createExtension(EXTTextureWebP).setRequired(true)
		const metallicRoughness = document
			.createTexture('mr')
			.setImage(new Uint8Array(16))
			.setMimeType('image/webp')
		vi.spyOn(metallicRoughness, 'getSize').mockReturnValue([4, 4])
		const body = document
			.createMaterial('body')
			.setMetallicRoughnessTexture(metallicRoughness)
		sceneDrawing(document, body)

		await bakeOcclusionIntoDocument(document, vi.fn())

		expect(metallicRoughness.getMimeType()).toBe('image/png')
		expect(document.getRoot().listExtensionsUsed()).toEqual([])
	})

	it('writes the bake as its own texture when it cannot pack', async () => {
		const document = new Document()
		const body = document.createMaterial('body')
		sceneDrawing(document, body)

		await bakeOcclusionIntoDocument(document, vi.fn())

		expect(body.getOcclusionTexture()?.getName()).toBe('body_occlusion')
		expect(document.getRoot().listTextures()).toHaveLength(1)
	})
})
