import { Document, Primitive } from '@gltf-transform/core'
import {
	EXTMeshGPUInstancing,
	KHRMaterialsTransmission
} from '@gltf-transform/extensions'
import { describe, expect, it } from 'vitest'

import { castsOcclusion, isGlass, planOcclusionBake } from './plan'

/*
  A flat grid of `side` by `side` vertices. Its UVs run from `uvMin` to
  `uvMax`, so a grid can be placed anywhere in UV space or past it.
*/
function grid(
	document: Document,
	{ side = 2, uvMin = 0, uvMax = 1, uvs = true } = {}
) {
	const positions: number[] = []
	const texcoords: number[] = []
	const indices: number[] = []
	for (let y = 0; y < side; y++) {
		for (let x = 0; x < side; x++) {
			const s = x / (side - 1)
			const t = y / (side - 1)
			positions.push(s, t, 0)
			texcoords.push(uvMin + s * (uvMax - uvMin), uvMin + t * (uvMax - uvMin))
			if (x < side - 1 && y < side - 1) {
				const i = y * side + x
				indices.push(i, i + 1, i + side, i + 1, i + side + 1, i + side)
			}
		}
	}
	const primitive = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			document
				.createAccessor()
				.setType('VEC3')
				.setArray(new Float32Array(positions))
		)
		.setIndices(
			document
				.createAccessor()
				.setType('SCALAR')
				.setArray(new Uint16Array(indices))
		)
	if (uvs) {
		primitive.setAttribute(
			'TEXCOORD_0',
			document
				.createAccessor()
				.setType('VEC2')
				.setArray(new Float32Array(texcoords))
		)
	}
	return primitive
}

function sceneOf(
	document: Document,
	...meshes: ReturnType<Document['createMesh']>[]
) {
	const scene = document.createScene()
	for (const mesh of meshes) scene.addChild(document.createNode().setMesh(mesh))
	return scene
}

const reasons = (plan: ReturnType<typeof planOcclusionBake>) =>
	plan.skipped.map(({ material, reason }) => [material.getName(), reason])

describe('planOcclusionBake', () => {
	it('targets a material whose UVs sit once inside the unit square', () => {
		const document = new Document()
		const material = document.createMaterial('body')
		sceneOf(
			document,
			document.createMesh().addPrimitive(grid(document).setMaterial(material))
		)

		const plan = planOcclusionBake(document)

		expect(plan.targets.map(({ material }) => material.getName())).toEqual([
			'body'
		])
		expect(plan.skipped).toEqual([])
	})

	it('keeps an existing occlusion texture', () => {
		const document = new Document()
		const material = document
			.createMaterial('baked')
			.setOcclusionTexture(document.createTexture())
		sceneOf(
			document,
			document.createMesh().addPrimitive(grid(document).setMaterial(material))
		)

		expect(reasons(planOcclusionBake(document))).toEqual([
			['baked', 'existing-occlusion']
		])
	})

	it('skips a material with no first UV set', () => {
		const document = new Document()
		const material = document.createMaterial('plain')
		sceneOf(
			document,
			document
				.createMesh()
				.addPrimitive(grid(document, { uvs: false }).setMaterial(material))
		)

		expect(reasons(planOcclusionBake(document))).toEqual([['plain', 'no-uv0']])
	})

	it('skips UVs that repeat the texture', () => {
		const document = new Document()
		const material = document.createMaterial('tiles')
		sceneOf(
			document,
			document
				.createMesh()
				.addPrimitive(grid(document, { uvMax: 4 }).setMaterial(material))
		)

		expect(reasons(planOcclusionBake(document))).toEqual([
			['tiles', 'tiling-uvs']
		])
	})

	it('skips two parts drawn over the same texels, as mirrored halves are', () => {
		const document = new Document()
		const material = document.createMaterial('mirrored')
		sceneOf(
			document,
			document
				.createMesh()
				.addPrimitive(grid(document).setMaterial(material))
				.addPrimitive(grid(document).setMaterial(material))
		)

		expect(reasons(planOcclusionBake(document))).toEqual([
			['mirrored', 'overlapping-uvs']
		])
	})

	it('does not count the edges of one seamless island as overlap', () => {
		// Every vertex sits on a texel center of the 256 comparison grid, 16
		// texels apart, so every shared edge runs through centers and would be
		// counted twice without the tie rule.
		const document = new Document()
		const material = document.createMaterial('seamless')
		sceneOf(
			document,
			document.createMesh().addPrimitive(
				grid(document, {
					side: 16,
					uvMin: 0.5 / 256,
					uvMax: 240.5 / 256
				}).setMaterial(material)
			)
		)

		expect(planOcclusionBake(document).skipped).toEqual([])
	})

	it('skips a mesh the scene places more than once', () => {
		const document = new Document()
		const material = document.createMaterial('wheel')
		const mesh = document
			.createMesh()
			.addPrimitive(grid(document).setMaterial(material))
		sceneOf(document, mesh, mesh)

		expect(reasons(planOcclusionBake(document))).toEqual([
			['wheel', 'shared-geometry']
		])
	})

	it('skips a mesh placed once per GPU instance', () => {
		const document = new Document()
		const material = document.createMaterial('bolt')
		const mesh = document
			.createMesh()
			.addPrimitive(grid(document).setMaterial(material))
		const instancing = document
			.createExtension(EXTMeshGPUInstancing)
			.createInstancedMesh()
		document
			.createScene()
			.addChild(
				document
					.createNode()
					.setMesh(mesh)
					.setExtension('EXT_mesh_gpu_instancing', instancing)
			)

		expect(reasons(planOcclusionBake(document))).toEqual([
			['bolt', 'shared-geometry']
		])
	})

	it('skips a skinned mesh', () => {
		const document = new Document()
		const material = document.createMaterial('cloth')
		document.createScene().addChild(
			document
				.createNode()
				.setSkin(document.createSkin())
				.setMesh(
					document
						.createMesh()
						.addPrimitive(grid(document).setMaterial(material))
				)
		)

		expect(reasons(planOcclusionBake(document))).toEqual([['cloth', 'skinned']])
	})

	it('ignores UVs of vertices no triangle draws', () => {
		const document = new Document()
		const material = document.createMaterial('pruned')
		const primitive = grid(document).setMaterial(material)
		const uv = primitive.getAttribute('TEXCOORD_0')!
		const position = primitive.getAttribute('POSITION')!
		uv.setArray(new Float32Array([...uv.getArray()!, 5, 5]))
		position.setArray(new Float32Array([...position.getArray()!, 0, 0, 0]))
		sceneOf(document, document.createMesh().addPrimitive(primitive))

		expect(planOcclusionBake(document).skipped).toEqual([])
	})

	it('lists only triangles in the scene the viewer opens', () => {
		const document = new Document()
		const lines = document.createMaterial('lines')
		document.createMaterial('unused')
		const other = document.createMaterial('other-scene')
		sceneOf(
			document,
			document.createMesh().addPrimitive(grid(document).setMaterial(other))
		)
		const opened = sceneOf(
			document,
			document
				.createMesh()
				.addPrimitive(
					grid(document).setMaterial(lines).setMode(Primitive.Mode['LINES'])
				)
		)
		document.getRoot().setDefaultScene(opened)

		const plan = planOcclusionBake(document)

		expect(plan.targets).toEqual([])
		expect(plan.skipped).toEqual([])
		expect(plan.primitives).toEqual([])
	})
})

describe('isGlass', () => {
	it('is true for transmission and for blended transparency, false otherwise', () => {
		const document = new Document()
		const transmission = document
			.createExtension(KHRMaterialsTransmission)
			.createTransmission()
			.setTransmissionFactor(1)
		const glass = document
			.createMaterial()
			.setExtension('KHR_materials_transmission', transmission)
		const blended = document.createMaterial().setAlphaMode('BLEND')
		const opaque = document.createMaterial()

		expect([
			isGlass(glass),
			isGlass(blended),
			isGlass(opaque),
			isGlass(null)
		]).toEqual([true, true, false, false])
	})

	it('is baked like any other surface', () => {
		const document = new Document()
		const glass = document.createMaterial('glass').setAlphaMode('BLEND')
		sceneOf(
			document,
			document.createMesh().addPrimitive(grid(document).setMaterial(glass))
		)

		expect(
			planOcclusionBake(document).targets.map(({ material }) => material)
		).toEqual([glass])
	})
})

describe('castsOcclusion', () => {
	it('is false for glass and for parts not drawn where their node puts them', () => {
		const document = new Document()
		const instancing = document
			.createExtension(EXTMeshGPUInstancing)
			.createInstancedMesh()
		const part = (material = document.createMaterial()) =>
			document.createMesh().addPrimitive(grid(document).setMaterial(material))
		const scene = document.createScene()
		scene.addChild(document.createNode('solid').setMesh(part()))
		scene.addChild(
			document
				.createNode('glass')
				.setMesh(part(document.createMaterial().setAlphaMode('BLEND')))
		)
		scene.addChild(
			document
				.createNode('skinned')
				.setSkin(document.createSkin())
				.setMesh(part())
		)
		scene.addChild(
			document
				.createNode('instanced')
				.setMesh(part())
				.setExtension('EXT_mesh_gpu_instancing', instancing)
		)

		const casts = planOcclusionBake(document).primitives.map((entry) => [
			entry.node.getName(),
			castsOcclusion(entry)
		])

		expect(casts).toEqual([
			['solid', true],
			['glass', false],
			['skinned', false],
			['instanced', false]
		])
	})
})
