import { EXTMeshGPUInstancing } from '@gltf-transform/extensions'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { createNodePublishCodecs } from '@vctrl/core/node'
import { describe, expect, it } from 'vitest'

import { corners, glbOf, meshDocument } from '../test-support'
import { describeDocument } from './describe-model'
import { readModelInNode } from './publish-export'

/** Four points on the xz plane: a diamond, whose box overstates it once rotated. */
const diamond = [
	[1, 0, 0],
	[-1, 0, 0],
	[0, 0, 1],
	[0, 0, -1]
]
const eighthTurn = [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]

describe('describeDocument', () => {
	it("measures the vertices through every ancestor's transform", () => {
		const { document, node } = meshDocument(corners([-1, 0, -1], [1, 1, 1]))
		node.setTranslation([1, 0, 0]).setName('leg')
		const parent = document.createNode().setScale([2, 2, 2]).addChild(node)
		document.getRoot().listScenes()[0].removeChild(node).addChild(parent)

		expect(describeDocument(document, undefined).bounds).toEqual({
			min: [0, 0, -2],
			max: [4, 2, 2],
			size: [4, 2, 4],
			center: [2, 1, 0]
		})
	})

	it('scales by the box the viewer normalizes, and places by the exact vertices, as the viewer does', () => {
		const { document, node } = meshDocument(diamond)
		node.setRotation(eighthTurn as [number, number, number, number])

		const off = describeDocument(document, undefined)
		// Rotated, the diamond's vertices reach 0.7071; its rotated box reaches 1.4142.
		expect(off.bounds?.max).toEqual([0.7071, 0, 0.7071])
		expect(off.viewer?.scale).toBe(1)

		// That box is 2.8284 square, a diagonal of 4; capped at 2, the scale is
		// 0.5, where the vertices alone would leave it at 1.
		const on = describeDocument(document, { enabled: true, maxSize: 2 })
		expect(on.viewer?.scale).toBe(0.5)
		expect(on.viewer?.bounds.max).toEqual([0.3536, 0, 0.3536])
	})

	it('dequantizes normalized positions, and widens the normalized box by morph targets', () => {
		const { document, primitive } = meshDocument([[0, 0, 0]])
		primitive
			.getAttribute('POSITION')
			?.setArray(new Int16Array([-32767, -32767, -32767, 32767, 32767, 32767]))
			.setNormalized(true)
		expect(describeDocument(document, undefined).bounds?.max).toEqual([1, 1, 1])
		// Normalized too: the diagonal, 3.46, is in range, so it is not scaled.
		expect(describeDocument(document, { enabled: true }).viewer?.scale).toBe(1)

		const morphed = meshDocument(corners([-1, -1, -1], [1, 1, 1]))
		const target = morphed.document.createPrimitiveTarget().setAttribute(
			'POSITION',
			morphed.document
				.createAccessor()
				.setType('VEC3')
				.setArray(new Float32Array([...Array(21).fill(0), 3, 0, 0]))
				.setBuffer(morphed.buffer)
		)
		morphed.primitive.addTarget(target)
		const plain = describeDocument(morphed.document, {
			enabled: true,
			maxSize: 2
		})
		// The box widens to x in [-4, 4]: diagonal sqrt(64 + 4 + 4) = 8.4853.
		expect(plain.viewer?.scale).toBeCloseTo(2 / Math.sqrt(72), 4)
		expect(plain.bounds?.size).toEqual([2, 2, 2])
	})

	it('measures a GPU-instanced mesh by every instance, as Box3 measures an InstancedMesh', async () => {
		const { document, node } = meshDocument(corners([-1, -1, -1], [1, 1, 1]))
		const instancing = document.createExtension(EXTMeshGPUInstancing)
		node.setTranslation([0, 100, 0]).setExtension(
			'EXT_mesh_gpu_instancing',
			instancing.createInstancedMesh().setAttribute(
				'TRANSLATION',
				document
					.createAccessor()
					.setType('VEC3')
					.setArray(new Float32Array([0, 0, 0, 10, 0, 0, 20, 5, 0]))
					.setBuffer(document.getRoot().listBuffers()[0])
			)
		)

		const read = await readModelInNode(await glbOf(document))
		const described = describeDocument(read, undefined)
		expect(described.bounds?.min).toEqual([-1, 99, -1])
		expect(described.bounds?.max).toEqual([21, 106, 1])
		expect(described.viewer?.bounds.min).toEqual([-11, 0, -1])
	})

	it('measures the shape the default morph weights open with, the node over the mesh', () => {
		const { document, mesh, node, primitive, buffer } = meshDocument(
			corners([0, 0, 0], [1, 1, 1])
		)
		primitive.addTarget(
			document.createPrimitiveTarget().setAttribute(
				'POSITION',
				document
					.createAccessor()
					.setType('VEC3')
					.setArray(
						new Float32Array(Array.from({ length: 8 }, () => [0, 1, 0]).flat())
					)
					.setBuffer(buffer)
			)
		)
		mesh.setWeights([1])

		const lifted = describeDocument(document, undefined)
		expect(lifted.bounds?.min).toEqual([0, 1, 0])
		expect(lifted.meshes[0].center).toEqual([0, 0.5, 0])

		node.setWeights([0])
		expect(describeDocument(document, undefined).bounds?.min).toEqual([0, 0, 0])
	})

	it('instances only triangles, and counts instances by any attribute, as GLTFLoader does', async () => {
		const instanced = (mode: number, semantic: string) => {
			const { document, node, primitive } = meshDocument(
				corners([-1, -1, -1], [1, 1, 1])
			)
			primitive.setMode(mode as 0)
			node.setExtension(
				'EXT_mesh_gpu_instancing',
				document
					.createExtension(EXTMeshGPUInstancing)
					.createInstancedMesh()
					.setAttribute(
						semantic,
						document
							.createAccessor()
							.setType('VEC3')
							.setArray(new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]))
							.setBuffer(document.getRoot().listBuffers()[0])
					)
			)
			return document
		}

		// POINTS: drawn once, uninstanced.
		const points = describeDocument(
			await readModelInNode(await glbOf(instanced(0, 'TRANSLATION'))),
			undefined
		)
		expect(points.bounds?.max).toEqual([1, 1, 1])
		// Only a custom attribute: three instances, each at identity.
		const tagged = describeDocument(
			await readModelInNode(await glbOf(instanced(4, '_ID'))),
			undefined
		)
		expect(tagged.bounds?.max).toEqual([1, 1, 1])
		expect(tagged.meshes).toHaveLength(1)
	})

	it("merges the node's morph weights over the mesh's one index at a time, and offsets a target with no POSITION by the base position", () => {
		const targetOf = (
			{ document, buffer }: ReturnType<typeof meshDocument>,
			semantic: string,
			step: number[]
		) =>
			document.createPrimitiveTarget().setAttribute(
				semantic,
				document
					.createAccessor()
					.setType('VEC3')
					.setArray(
						new Float32Array(Array.from({ length: 8 }, () => step).flat())
					)
					.setBuffer(buffer)
			)

		const lifted = meshDocument(corners([0, 0, 0], [1, 1, 1]))
		lifted.primitive
			.addTarget(targetOf(lifted, 'POSITION', [0, 2, 0]))
			.addTarget(targetOf(lifted, 'POSITION', [4, 0, 0]))
		lifted.mesh.setWeights([0, 1])
		lifted.node.setWeights([0.5])
		// Influences [0.5, 1]: y lifted by 1, x moved by 4.
		expect(describeDocument(lifted.document, undefined).bounds?.min).toEqual([
			4, 1, 0
		])

		const doubled = meshDocument(corners([1, 1, 1], [2, 2, 2]))
		doubled.primitive
			.addTarget(targetOf(doubled, 'POSITION', [0, 0, 0]))
			.addTarget(targetOf(doubled, 'NORMAL', [0, 1, 0]))
		doubled.mesh.setWeights([0, 1])
		// The second target moves each vertex by its own position.
		expect(describeDocument(doubled.document, undefined).bounds?.max).toEqual([
			4, 4, 4
		])

		// With no target moving POSITION, nothing moves.
		const normalsOnly = meshDocument(corners([1, 1, 1], [2, 2, 2]))
		normalsOnly.primitive.addTarget(targetOf(normalsOnly, 'NORMAL', [0, 1, 0]))
		normalsOnly.mesh.setWeights([1])
		expect(
			describeDocument(normalsOnly.document, undefined).bounds?.max
		).toEqual([2, 2, 2])

		// Points are measured unmorphed, as Box3 measures them.
		const points = meshDocument(corners([0, 0, 0], [1, 1, 1]))
		points.primitive
			.setMode(0)
			.addTarget(targetOf(points, 'POSITION', [0, 5, 0]))
		points.mesh.setWeights([1])
		expect(describeDocument(points.document, undefined).bounds?.max).toEqual([
			1, 1, 1
		])
	})

	it('places the model centered on x and z, resting on y = 0, and each mesh in the same space', () => {
		const { document, node } = meshDocument(corners([2, 5, 2], [4, 25, 4]))
		node.setName('tower')

		expect(describeDocument(document, undefined)).toMatchObject({
			viewer: {
				scale: 1,
				normalization: false,
				bounds: {
					min: [-1, 0, -1],
					max: [1, 20, 1],
					size: [2, 20, 2],
					center: [0, 10, 0]
				}
			},
			meshes: [
				{ name: 'tower', materials: [], center: [0, 10, 0], size: [2, 20, 2] }
			]
		})

		// The diagonal is sqrt(408) = 20.199; capped at the default 5.
		const on = describeDocument(document, { enabled: true })
		expect(on.viewer?.scale).toBeCloseTo(5 / Math.sqrt(408), 4)
		expect(on.viewer?.normalization).toBe(true)
		expect(on.viewer?.bounds.min[1]).toBe(0)
		expect(on.viewer?.bounds.size[1]).toBeCloseTo(100 / Math.sqrt(408), 3)
		expect(on.meshes[0].center[0]).toBe(0)
	})

	it('names meshes, materials and clips, with fallbacks', () => {
		const { document, primitive, mesh, node } = meshDocument(
			corners([0, 0, 0], [1, 1, 1])
		)
		const leather = document
			.createMaterial('Leather')
			.setBaseColorFactor([0.5, 0.2, 0.1, 1])
			.setRoughnessFactor(0.6)
			.setBaseColorTexture(document.createTexture())
			.setNormalTexture(document.createTexture())
		primitive.setMaterial(leather)
		mesh.addPrimitive(
			document
				.createPrimitive()
				.setAttribute('POSITION', primitive.getAttribute('POSITION'))
				.setMaterial(leather)
		)
		node.setName('seat')
		const body = document
			.createMesh('body')
			.addPrimitive(
				document
					.createPrimitive()
					.setAttribute('POSITION', primitive.getAttribute('POSITION'))
					.setMaterial(
						document.createMaterial().setAlphaMode('BLEND').setDoubleSided(true)
					)
			)
		const skinnedNode = document
			.createNode()
			.setMesh(body)
			.setSkin(document.createSkin())
		document.getRoot().listScenes()[0].addChild(skinnedNode)

		const times = (max: number) =>
			document
				.createAccessor()
				.setType('SCALAR')
				.setArray(new Float32Array([0, max]))
				.setBuffer(document.getRoot().listBuffers()[0])
		const sampler = (max: number) =>
			document.createAnimationSampler().setInput(times(max)).setOutput(times(1))
		const open = document.createAnimation('Open')
		const [a, b] = [sampler(2.5), sampler(4)]
		open.addSampler(a).addSampler(b)
		open.addChannel(
			document
				.createAnimationChannel()
				.setSampler(a)
				.setTargetNode(node)
				.setTargetPath('translation')
		)
		open.addChannel(
			document
				.createAnimationChannel()
				.setSampler(b)
				.setTargetNode(node)
				.setTargetPath('scale')
		)
		document.createAnimation().addSampler(sampler(2.5))

		const described = describeDocument(document, undefined)

		expect(
			described.meshes.map(({ name, materials }) => ({ name, materials }))
		).toEqual([
			{ name: 'seat', materials: ['Leather'] },
			{ name: 'body', materials: ['material 1'] }
		])
		expect(described.materials).toEqual([
			{
				name: 'Leather',
				baseColor: [0.5, 0.2, 0.1, 1],
				metallic: 1,
				roughness: 0.6,
				alphaMode: 'OPAQUE',
				doubleSided: false,
				textures: ['baseColor', 'normal']
			},
			{
				name: 'material 1',
				baseColor: [1, 1, 1, 1],
				metallic: 1,
				roughness: 1,
				alphaMode: 'BLEND',
				doubleSided: true,
				textures: []
			}
		])
		expect(described.animations).toEqual([
			{ name: 'Open', duration: 4, channels: 2 },
			{ name: 'animation 1', duration: 2.5, channels: 0 }
		])
		expect(described.note).toMatch(/Skinned/)
		expect(
			describeDocument(meshDocument(diamond).document, undefined).note
		).toBeUndefined()
	})

	it('answers a model with no geometry without bounds', () => {
		const { document, node } = meshDocument(diamond)
		node.setMesh(null)
		const described = describeDocument(document, undefined)
		expect(described.bounds).toBeNull()
		expect(described.viewer).toBeNull()
		expect(described.meshes).toEqual([])
	})

	it('reads a Draco-compressed GLB to the same answer', async () => {
		const { document, node } = meshDocument(corners([-1, 0, -2], [3, 4, 2]))
		node.setRotation(eighthTurn as [number, number, number, number])
		const plain = await glbOf(document)
		const { data: compressed } = await new ModelExporter({
			dracoModules: createNodePublishCodecs().dracoModules
		}).exportDocumentGLBDraco(document)
		expect(new TextDecoder().decode(compressed)).toContain(
			'KHR_draco_mesh_compression'
		)

		const fromPlain = describeDocument(await readModelInNode(plain), undefined)
		const fromDraco = describeDocument(
			await readModelInNode(compressed),
			undefined
		)
		expect(fromDraco.bounds?.size).toEqual(fromPlain.bounds?.size)
		expect(fromDraco.viewer).toEqual(fromPlain.viewer)
	})
})
