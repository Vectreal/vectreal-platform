/**
 * The baked lights' file format and what decides whether a map still matches
 * the scene's lighting. The GPU bake itself runs in `vctrl/viewer-e2e`.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import {
	ALL_EXTENSIONS,
	KHRMaterialsTransmission,
	KHRMaterialsUnlit,
	KHRTextureBasisu
} from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'

import { bakeLightsIntoDocument, writeLightmaps } from './bake-into-document'
import { lightmapScale } from './bake-lights'
import { type Lightmap } from './extension'
import { IO_EXTENSIONS } from '../io-extensions'
import {
	bakedLightsSignature,
	LIGHTMAP_EXTENSION
} from '../scene-lighting/baked-lights'
import { resolveLighting } from '../scene-lighting/resolve-lighting'

const image = new Uint8Array([137, 80, 78, 71, 1, 2, 3])

function documentWithLightmap() {
	const document = new Document()
	document.createBuffer()
	const material = document.createMaterial('body')
	writeLightmaps(document, 'baked-from', [{ material, scale: 2.5, image }])
	return document
}

describe('VECTREAL_lightmap', () => {
	it('survives a write and read wherever it is registered', async () => {
		const io = new NodeIO().registerExtensions(IO_EXTENSIONS)
		const read = await io.readBinary(
			await io.writeBinary(documentWithLightmap())
		)

		const [material] = read.getRoot().listMaterials()
		const lightmap = material.getExtension<Lightmap>(LIGHTMAP_EXTENSION)
		expect(lightmap?.getScale()).toBe(2.5)
		expect(lightmap?.getSignature()).toBe('baked-from')
		expect(lightmap?.getTextureInfo()?.getTexCoord()).toBe(0)
		expect(lightmap?.getTexture()?.getImage()).toEqual(image)
	})

	it('is dropped by a reader that has not registered it', async () => {
		const glb = await new NodeIO()
			.registerExtensions(IO_EXTENSIONS)
			.writeBinary(documentWithLightmap())
		const read = await new NodeIO()
			.registerExtensions(ALL_EXTENSIONS)
			.readBinary(glb)

		const [material] = read.getRoot().listMaterials()
		expect(material.getExtension(LIGHTMAP_EXTENSION)).toBeNull()
	})

	it('stays a loadable KTX2 texture once the textures are encoded', async () => {
		const document = documentWithLightmap()
		document.createExtension(KHRTextureBasisu).setRequired(true)
		for (const texture of document.getRoot().listTextures()) {
			texture.setMimeType('image/ktx2')
		}
		const io = new NodeIO().registerExtensions(IO_EXTENSIONS)

		const { json } = await io.writeJSON(document)
		const [lightmapTexture] = json.textures ?? []
		// Under the extension, never as a plain image three would try to decode.
		expect(lightmapTexture.source).toBeUndefined()
		expect(lightmapTexture.extensions?.['KHR_texture_basisu']).toEqual({
			source: 0
		})

		const [material] = (await io.readBinary(await io.writeBinary(document)))
			.getRoot()
			.listMaterials()
		expect(
			material
				.getExtension<Lightmap>(LIGHTMAP_EXTENSION)
				?.getTexture()
				?.getMimeType()
		).toBe('image/ktx2')
	})

	it('writes nothing when nothing was baked', async () => {
		const document = new Document()
		document.createMaterial('body')
		writeLightmaps(document, 'baked-from', [])

		expect(document.getRoot().listExtensionsUsed()).toEqual([])
	})
})

const lighting = (overrides: Parameters<typeof resolveLighting>[0] = {}) =>
	resolveLighting({
		lighting: {
			environment: { rotation: 30, intensity: 1 },
			lights: [
				{ role: 'key', azimuth: 40, elevation: 50, intensity: 2 },
				{ role: 'fill', azimuth: -60, elevation: 20, intensity: 0.5 }
			],
			...overrides.lighting
		}
	})

describe('the baked lights signature', () => {
	const base = bakedLightsSignature(lighting())

	it('changes when what the map holds changes', () => {
		const turned = lighting({
			lighting: { environment: { rotation: 31 } }
		})
		const moved = lighting({
			lighting: {
				lights: [{ role: 'key', azimuth: 41, elevation: 50, intensity: 2 }]
			}
		})
		const recolored = lighting({
			lighting: {
				lights: [
					{
						role: 'key',
						azimuth: 40,
						elevation: 50,
						intensity: 2,
						color: '#ff0000'
					},
					{ role: 'fill', azimuth: -60, elevation: 20, intensity: 0.5 }
				]
			}
		})

		expect(bakedLightsSignature(turned)).not.toBe(base)
		expect(bakedLightsSignature(moved)).not.toBe(base)
		expect(bakedLightsSignature(recolored)).not.toBe(base)
	})

	it('ignores what the viewer scales the map by, and lights that are off', () => {
		const brighter = lighting({
			lighting: {
				environment: { rotation: 30, intensity: 3, map: 'nature-park' }
			}
		})
		const withOff = lighting({
			lighting: {
				lights: [
					{ role: 'key', azimuth: 40, elevation: 50, intensity: 2 },
					{ role: 'fill', azimuth: -60, elevation: 20, intensity: 0.5 },
					{ role: 'rim', enabled: false }
				]
			}
		})

		expect(bakedLightsSignature(brighter)).toBe(base)
		expect(bakedLightsSignature(withOff)).toBe(base)
	})
})

describe('lightmapScale', () => {
	it('is the most light a texel can hold', () => {
		expect(lightmapScale(lighting())).toBeCloseTo(2.5)
	})

	it('counts a colored light by its brightest channel', () => {
		const red = resolveLighting({
			lighting: { lights: [{ role: 'key', intensity: 2, color: '#ff0000' }] }
		})
		expect(lightmapScale(red)).toBeCloseTo(2)
	})
})

/** One flat card, bakeable apart from what each case adds. */
function cardDocument({
	doubleSided = false,
	animatedParent = false,
	morphed = false,
	staticBody = false,
	cutout = false,
	ktx2Mask = false,
	brokenMask = false,
	glass = false,
	unlit = false
} = {}) {
	const document = new Document()
	const buffer = document.createBuffer()
	const accessor = (type: 'VEC2' | 'VEC3' | 'SCALAR', values: number[]) =>
		document
			.createAccessor()
			.setBuffer(buffer)
			.setType(type)
			.setArray(
				type === 'SCALAR' ? new Uint16Array(values) : new Float32Array(values)
			)
	const primitive = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			accessor('VEC3', [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])
		)
		.setAttribute('TEXCOORD_0', accessor('VEC2', [0, 0, 1, 0, 1, 1, 0, 1]))
		.setIndices(accessor('SCALAR', [0, 1, 2, 0, 2, 3]))
		.setMaterial(
			document
				.createMaterial('label')
				.setDoubleSided(doubleSided)
				.setAlphaMode(cutout ? 'MASK' : 'OPAQUE')
		)
	if (ktx2Mask) {
		primitive
			.getMaterial()!
			.setBaseColorTexture(
				document
					.createTexture()
					.setImage(new Uint8Array(4))
					.setMimeType('image/ktx2')
			)
	}
	if (brokenMask) {
		primitive
			.getMaterial()!
			.setBaseColorTexture(
				document
					.createTexture()
					.setImage(new Uint8Array(4))
					.setMimeType('image/png')
			)
	}
	if (glass) {
		primitive
			.getMaterial()!
			.setExtension(
				'KHR_materials_transmission',
				document
					.createExtension(KHRMaterialsTransmission)
					.createTransmission()
					.setTransmissionFactor(1)
			)
	}
	if (unlit) {
		primitive
			.getMaterial()!
			.setExtension(
				'KHR_materials_unlit',
				document.createExtension(KHRMaterialsUnlit).createUnlit()
			)
	}
	if (morphed) {
		primitive.addTarget(
			document
				.createPrimitiveTarget()
				.setAttribute('POSITION', accessor('VEC3', new Array(12).fill(0)))
		)
	}
	const card = document
		.createNode()
		.setMesh(document.createMesh().addPrimitive(primitive))
	const lid = document.createNode('lid').addChild(card)
	const scene = document.createScene().addChild(lid)
	if (staticBody) {
		scene.addChild(
			document.createNode('base').setMesh(
				document.createMesh().addPrimitive(
					document
						.createPrimitive()
						.setAttribute(
							'POSITION',
							accessor('VEC3', [0, 0, 1, 1, 0, 1, 1, 0, 2, 0, 0, 2])
						)
						.setAttribute(
							'TEXCOORD_0',
							accessor('VEC2', [0, 0, 1, 0, 1, 1, 0, 1])
						)
						.setIndices(accessor('SCALAR', [0, 2, 1, 0, 3, 2]))
						.setMaterial(document.createMaterial('body'))
				)
			)
		)
	}
	if (animatedParent) {
		const sampler = document
			.createAnimationSampler()
			.setInput(accessor('SCALAR', [0, 1]))
			.setOutput(
				document
					.createAccessor()
					.setBuffer(buffer)
					.setType('VEC4')
					.setArray(new Float32Array([0, 0, 0, 1, 0, 0.7, 0, 0.7]))
			)
		document
			.createAnimation()
			.addSampler(sampler)
			.addChannel(
				document
					.createAnimationChannel()
					.setTargetNode(lid)
					.setTargetPath('rotation')
					.setSampler(sampler)
			)
	}
	return document
}

const noRenderer = () => {
	throw new Error('nothing here can be baked')
}

describe('bakeLightsIntoDocument', () => {
	it('leaves a double-sided material to the live lights', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ doubleSided: true }),
			lighting(),
			noRenderer
		)

		expect(report).toEqual({
			baked: [],
			skipped: [{ material: 'label', reason: 'double-sided' }]
		})
	})

	it('leaves a part an animation turns, through its parent, to the live lights', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ animatedParent: true }),
			lighting(),
			noRenderer
		)

		expect(report.skipped).toEqual([{ material: 'label', reason: 'animated' }])
	})

	it('leaves the rest to the live lights while a moving part shadows it', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ animatedParent: true, staticBody: true }),
			lighting(),
			noRenderer
		)

		expect(report.skipped).toEqual([
			{ material: 'label', reason: 'animated' },
			{ material: 'body', reason: 'moving-shadows' }
		])
	})

	it('bakes past a cutout whose mask it can read', async () => {
		await expect(
			bakeLightsIntoDocument(
				cardDocument({ cutout: true, staticBody: true }),
				lighting(),
				noRenderer
			)
		).rejects.toThrow('nothing here can be baked')
	})

	it('leaves everything to the live lights while an unreadable cutout casts', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ cutout: true, ktx2Mask: true, staticBody: true }),
			lighting(),
			noRenderer
		)

		expect(report.skipped).toEqual([
			{ material: 'label', reason: 'cutout-shadows' },
			{ material: 'body', reason: 'cutout-shadows' }
		])
	})

	it('still bakes past a cutout that lets light through', async () => {
		await expect(
			bakeLightsIntoDocument(
				cardDocument({
					cutout: true,
					ktx2Mask: true,
					glass: true,
					staticBody: true
				}),
				lighting(),
				noRenderer
			)
		).rejects.toThrow('nothing here can be baked')
	})

	it('leaves everything to the live lights while a mask that did not decode casts', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ cutout: true, brokenMask: true, staticBody: true }),
			lighting(),
			noRenderer
		)

		expect(report.skipped).toEqual([
			{ material: 'label', reason: 'cutout-shadows' },
			{ material: 'body', reason: 'cutout-shadows' }
		])
	})

	it('bakes no light into an unlit material', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ unlit: true }),
			lighting(),
			noRenderer
		)

		expect(report).toEqual({
			baked: [],
			skipped: [{ material: 'label', reason: 'unlit' }]
		})
	})

	it('leaves a part morph targets reshape to the live lights', async () => {
		const report = await bakeLightsIntoDocument(
			cardDocument({ morphed: true }),
			lighting(),
			noRenderer
		)

		expect(report.skipped).toEqual([{ material: 'label', reason: 'animated' }])
	})
})
