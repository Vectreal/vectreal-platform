import { Document } from '@gltf-transform/core'
import { KHRTextureTransform } from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'

import {
	cutoutVertexAlphas,
	cutoutUvs,
	decodeCutoutMasks,
	MAX_MASK_LAYERS,
	readableCutout
} from './cutouts'
import { listScenePrimitives } from './scene-primitives'

function maskedQuad(document: Document) {
	const material = document
		.createMaterial('leaf')
		.setAlphaMode('MASK')
		.setAlphaCutoff(0.3)
		.setBaseColorFactor([1, 1, 1, 0.8])
	const primitive = document
		.createPrimitive()
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
		.setAttribute(
			'TEXCOORD_1',
			document
				.createAccessor()
				.setType('VEC2')
				.setArray(new Float32Array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]))
		)
		.setMaterial(material)
	return { material, primitive }
}

const texture = (document: Document, mimeType: string) =>
	document
		.createTexture()
		.setImage(new Uint8Array([1, 2, 3]))
		.setMimeType(mimeType)

describe('readableCutout', () => {
	it('is undefined for a part that is not alpha-masked', () => {
		const document = new Document()
		expect(readableCutout(document.createMaterial())).toBeUndefined()
		expect(
			readableCutout(document.createMaterial().setAlphaMode('BLEND'))
		).toBeUndefined()
	})

	it('reads the cutoff and factor, with or without a texture', () => {
		const document = new Document()
		const { material } = maskedQuad(document)

		expect(readableCutout(material)).toMatchObject({
			cutoff: 0.3,
			alphaFactor: expect.closeTo(0.8),
			image: null
		})
		material.setBaseColorTexture(texture(document, 'image/webp'))
		expect(readableCutout(material)?.image).toEqual(new Uint8Array([1, 2, 3]))
	})

	it('reads the wrap the texture samples with', () => {
		const document = new Document()
		const { material } = maskedQuad(document)
		material.setBaseColorTexture(texture(document, 'image/png'))
		expect(readableCutout(material)?.wrap).toEqual([0, 0])

		material.getBaseColorTextureInfo()!.setWrapS(33071).setWrapT(33648)
		expect(readableCutout(material)?.wrap).toEqual([1, 2])
	})

	it('cannot read a mask a browser does not decode, which then casts solid', () => {
		const document = new Document()
		const { material } = maskedQuad(document)
		material.setBaseColorTexture(texture(document, 'image/ktx2'))

		expect(readableCutout(material)).toBeUndefined()
	})
})

describe('cutoutUvs', () => {
	it('reads the UV set the texture names, through its transform', () => {
		const document = new Document()
		const { material, primitive } = maskedQuad(document)
		material.setBaseColorTexture(texture(document, 'image/png'))
		material
			.getBaseColorTextureInfo()!
			.setExtension(
				'KHR_texture_transform',
				document
					.createExtension(KHRTextureTransform)
					.createTransform()
					.setOffset([0.25, 0])
					.setScale([0.5, 1])
			)

		const uvs = cutoutUvs(primitive, readableCutout(material)!)
		expect(Array.from(uvs)).toEqual([0.25, 0, 0.75, 0, 0.25, 1])

		material.getBaseColorTextureInfo()!.setTexCoord(1)
		material
			.getBaseColorTextureInfo()!
			.setExtension('KHR_texture_transform', null)
		expect(Array.from(cutoutUvs(primitive, readableCutout(material)!))).toEqual(
			[0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
		)
	})
})

describe('cutoutVertexAlphas', () => {
	it('reads the vertex alpha glTF multiplies in, 1 without RGBA colors', () => {
		const document = new Document()
		const { primitive } = maskedQuad(document)
		expect(Array.from(cutoutVertexAlphas(primitive))).toEqual([1, 1, 1])

		primitive.setAttribute(
			'COLOR_0',
			document
				.createAccessor()
				.setType('VEC4')
				.setArray(new Float32Array([1, 1, 1, 1, 1, 1, 1, 0.5, 1, 1, 1, 0]))
		)
		expect(Array.from(cutoutVertexAlphas(primitive))).toEqual([1, 0.5, 0])
	})
})

describe('decodeCutoutMasks', () => {
	const sceneOf = (document: Document, materials: unknown[]) => {
		const scene = document.createScene()
		for (const material of materials) {
			const { primitive } = maskedQuad(document)
			primitive.setMaterial(material as ReturnType<Document['createMaterial']>)
			scene.addChild(
				document
					.createNode()
					.setMesh(document.createMesh().addPrimitive(primitive))
			)
		}
		return listScenePrimitives(document)
	}

	it('leaves a mask that does not decode to cast solid, and bakes on', async () => {
		const document = new Document()
		const broken = document
			.createMaterial('broken')
			.setAlphaMode('MASK')
			.setBaseColorTexture(texture(document, 'image/png'))
		const plain = document.createMaterial('plain').setAlphaMode('MASK')

		const { layerOf, params } = await decodeCutoutMasks(
			sceneOf(document, [broken, plain])
		)

		expect([...layerOf.keys()].map((material) => material.getName())).toEqual([
			'plain'
		])
		// Repeat on both axes, and the default cutoff of 0.5 as a byte.
		expect(Array.from(params)).toEqual([0, 0, 128, 0])
	})

	it('scales the mask by the alpha factor and packs the cutoff as a byte', async () => {
		const document = new Document()
		const faded = document
			.createMaterial()
			.setAlphaMode('MASK')
			.setBaseColorFactor([1, 1, 1, 0.8])

		const outOfSpec = document
			.createMaterial()
			.setAlphaMode('MASK')
			.setAlphaCutoff(-0.1)

		const { layers, params } = await decodeCutoutMasks(
			sceneOf(document, [faded, outOfSpec])
		)

		expect(new Set(layers.subarray(0, layers.length / 2))).toEqual(
			new Set([204])
		)
		// A cutoff below 0 draws every texel, like 0, rather than wrapping.
		expect(params[6]).toBe(0)
	})

	it('reads at most MAX_MASK_LAYERS masks', async () => {
		const document = new Document()
		const materials = Array.from({ length: MAX_MASK_LAYERS + 1 }, () =>
			document.createMaterial().setAlphaMode('MASK')
		)

		const { layerOf, params } = await decodeCutoutMasks(
			sceneOf(document, materials)
		)

		expect(layerOf.size).toBe(MAX_MASK_LAYERS)
		expect(params.length).toBe(MAX_MASK_LAYERS * 4)
	})
})
