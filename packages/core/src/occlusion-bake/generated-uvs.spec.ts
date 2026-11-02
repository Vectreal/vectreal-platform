/**
 * The UV set laid out for the bake, pinned against glTF-Transform's
 * `unwrapPrimitives`, which is experimental: a minor release that changes
 * what it does fails here, not in a published file. Lays out with the real
 * watlas.
 */
import { Document, type Material, type Primitive } from '@gltf-transform/core'
import { KHRMaterialsUnlit } from '@gltf-transform/extensions'
import { describe, expect, it, vi } from 'vitest'

import {
	planBakeUvs,
	withoutBakeUvs,
	writeBakeUvs,
	type Watlas
} from './generated-uvs'
import { planOcclusionBake, readUvs } from './plan'
import { triangleIndices } from './scene-primitives'
import { planBakeUvsFor } from '../light-bake/bake-into-document'

/** The six faces of a unit cube, each with its own corners, and UVs that repeat. */
function box(document: Document, material: Material, extraSets = 0) {
	const corners = [
		[
			[0, 0, 1],
			[1, 0, 1],
			[1, 1, 1],
			[0, 1, 1]
		],
		[
			[1, 0, 0],
			[0, 0, 0],
			[0, 1, 0],
			[1, 1, 0]
		],
		[
			[1, 0, 1],
			[1, 0, 0],
			[1, 1, 0],
			[1, 1, 1]
		],
		[
			[0, 0, 0],
			[0, 0, 1],
			[0, 1, 1],
			[0, 1, 0]
		],
		[
			[0, 1, 1],
			[1, 1, 1],
			[1, 1, 0],
			[0, 1, 0]
		],
		[
			[0, 0, 0],
			[1, 0, 0],
			[1, 0, 1],
			[0, 0, 1]
		]
	]
	const positions: number[] = []
	const uvs: number[] = []
	const indices: number[] = []
	corners.forEach((face, f) => {
		for (const corner of face) positions.push(...corner)
		// Every face reads the same two tiles: UVs that repeat and overlap.
		uvs.push(0, 0, 2, 0, 2, 2, 0, 2)
		const i = f * 4
		indices.push(i, i + 1, i + 2, i, i + 2, i + 3)
	})
	const vec = (type: 'VEC2' | 'VEC3', values: number[]) =>
		document.createAccessor().setType(type).setArray(new Float32Array(values))
	const primitive = document
		.createPrimitive()
		.setAttribute('POSITION', vec('VEC3', positions))
		.setAttribute('TEXCOORD_0', vec('VEC2', uvs))
		.setIndices(
			document
				.createAccessor()
				.setType('SCALAR')
				.setArray(new Uint16Array(indices))
		)
		.setMaterial(material)
	for (let set = 1; set <= extraSets; set++) {
		primitive.setAttribute(
			`TEXCOORD_${set}`,
			vec(
				'VEC2',
				uvs.map(() => 0.5)
			)
		)
	}
	return primitive
}

/** Two boxes of one material, side by side, and a clean card of another. */
function model({ extraSets = 0 } = {}) {
	const document = new Document()
	const tiled = document.createMaterial('tiled')
	const clean = document.createMaterial('clean')
	const scene = document.createScene()
	for (const x of [0, 3]) {
		scene.addChild(
			document
				.createNode()
				.setTranslation([x, 0, 0])
				.setMesh(
					document.createMesh().addPrimitive(box(document, tiled, extraSets))
				)
		)
	}
	const card = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			document
				.createAccessor()
				.setType('VEC3')
				.setArray(new Float32Array([0, 0, -2, 1, 0, -2, 1, 1, -2, 0, 1, -2]))
		)
		.setAttribute(
			'TEXCOORD_0',
			document
				.createAccessor()
				.setType('VEC2')
				.setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
		)
		.setIndices(
			document
				.createAccessor()
				.setType('SCALAR')
				.setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
		)
		.setMaterial(clean)
	scene.addChild(
		document.createNode().setMesh(document.createMesh().addPrimitive(card))
	)
	return { document, tiled, clean }
}

/** A watlas of its own: one instance lays out the same parts the same way once. */
async function freshWatlas(): Promise<Watlas> {
	vi.resetModules()
	return (await import('watlas')) as Watlas
}

/** Every triangle corner's value of `semantic`, in drawing order. */
function corners(primitive: Primitive, semantic: string) {
	const accessor = primitive.getAttribute(semantic)!
	const element: number[] = []
	return Array.from(triangleIndices(primitive), (i) => [
		...accessor.getElement(i, element)
	])
}

const tiledPrimitives = (document: Document) =>
	document
		.getRoot()
		.listMeshes()
		.flatMap((mesh) => mesh.listPrimitives())
		.filter((primitive) => primitive.getMaterial()?.getName() === 'tiled')

describe('planBakeUvs', () => {
	it('plans a layout only for the materials whose own UVs fail', () => {
		const { document, tiled, clean } = model()

		const planned = planBakeUvs(document)!

		expect(planned.texCoord).toBe(1)
		expect([...planned.materials]).toEqual([[tiled, undefined]])
		expect(planned.materials.has(clean)).toBe(false)
		expect(planned.primitives).toHaveLength(2)
	})

	it('plans none when every material bakes on its own UVs', () => {
		const document = new Document()
		document.createScene()
		expect(planBakeUvs(document)).toBeUndefined()
	})

	it('takes the first set none of its parts carries, so nothing is replaced', () => {
		expect(planBakeUvs(model({ extraSets: 1 }).document)!.texCoord).toBe(2)
	})

	it('says so when every set a viewer reads is in use', () => {
		const { document, tiled } = model({ extraSets: 3 })

		const planned = planBakeUvs(document)!

		expect(planned.materials.get(tiled)).toBe('no-free-uv-set')
		expect(planned.primitives).toEqual([])
	})

	it('lays out nothing past its triangle budget, and says so', () => {
		const { document, tiled } = model()

		const planned = planBakeUvs(document, { maxTriangles: 23 })!

		expect(planned.materials.get(tiled)).toBe('too-detailed')
		expect(planned.primitives).toEqual([])
	})

	it('leaves out a textured material missing the set its texture reads', () => {
		const { document, tiled } = model()
		tiled.setBaseColorTexture(document.createTexture())
		for (const primitive of tiledPrimitives(document)) {
			primitive.setAttribute('TEXCOORD_0', null)
		}

		const planned = planBakeUvs(document)!

		// The layout would fill TEXCOORD_0 too, and move the texture.
		expect(planned.materials.get(tiled)).toBe('no-uv0')
		expect(planned.primitives).toEqual([])
	})

	it('keeps a left-out material’s own reason', () => {
		const { document, tiled } = model()
		// A normal map reads a set no part carries, which the layout would fill.
		tiled.setNormalTexture(document.createTexture())
		tiled.getNormalTextureInfo()!.setTexCoord(1)

		expect(planBakeUvs(document)!.materials.get(tiled)).toBe('tiling-uvs')
	})

	it('reports every material it was planned for as a reason of the caller’s', () => {
		const { document, tiled } = model()

		const planned = withoutBakeUvs(planBakeUvs(document)!, 'too-detailed')

		expect(planned.materials.get(tiled)).toBe('too-detailed')
		expect(planned.primitives).toEqual([])
	})
})

describe('writeBakeUvs', () => {
	it('lays out one atlas across every part, in the planned set, without moving what they draw', async () => {
		const { document } = model()
		const before = tiledPrimitives(document).map((primitive) => ({
			positions: corners(primitive, 'POSITION'),
			uvs: corners(primitive, 'TEXCOORD_0')
		}))

		await writeBakeUvs(planBakeUvs(document)!, await freshWatlas())

		const after = tiledPrimitives(document)
		after.forEach((primitive, i) => {
			expect(corners(primitive, 'POSITION')).toEqual(before[i].positions)
			expect(corners(primitive, 'TEXCOORD_0')).toEqual(before[i].uvs)
			expect(primitive.getAttribute('TEXCOORD_1')).not.toBeNull()
		})
		// Both boxes in one atlas: read as one material's UVs, they neither
		// repeat nor overlap.
		const merged = new Document()
		const material = merged.createMaterial('atlas')
		const scene = merged.createScene()
		for (const primitive of after) {
			const copy = box(merged, material)
			copy.setAttribute(
				'TEXCOORD_0',
				merged
					.createAccessor()
					.setType('VEC2')
					.setArray(
						new Float32Array(
							corners(primitive, 'TEXCOORD_1').flatMap(([u, v]) => [u, v])
						)
					)
			)
			copy.setAttribute(
				'POSITION',
				merged
					.createAccessor()
					.setType('VEC3')
					.setArray(new Float32Array(corners(primitive, 'POSITION').flat()))
			)
			copy.setIndices(
				merged
					.createAccessor()
					.setType('SCALAR')
					.setArray(
						new Uint32Array(
							Array.from(
								{ length: triangleIndices(primitive).length },
								(_, i) => i
							)
						)
					)
			)
			scene.addChild(
				merged.createNode().setMesh(merged.createMesh().addPrimitive(copy))
			)
		}
		expect(planOcclusionBake(merged).skipped).toEqual([])
	})

	it('leaves a set a part already carries alone', async () => {
		const { document } = model({ extraSets: 1 })
		const own = tiledPrimitives(document).map((primitive) =>
			readUvs(primitive, 1)
		)

		await writeBakeUvs(planBakeUvs(document)!, await freshWatlas())

		tiledPrimitives(document).forEach((primitive, i) => {
			// The layout went into TEXCOORD_2; TEXCOORD_1 keeps its values.
			expect(primitive.getAttribute('TEXCOORD_2')).not.toBeNull()
			expect(new Set(readUvs(primitive, 1))).toEqual(new Set(own[i]))
		})
	})

	it('never overwrites the set it is given, even one a part carries', async () => {
		const { document } = model({ extraSets: 1 })
		const own = tiledPrimitives(document).map((primitive) =>
			readUvs(primitive, 1)
		)
		const planned = { ...planBakeUvs(document)!, texCoord: 1 }

		await writeBakeUvs(planned, await freshWatlas())

		tiledPrimitives(document).forEach((primitive, i) => {
			expect(new Set(readUvs(primitive, 1))).toEqual(new Set(own[i]))
		})
	})

	it('keeps a part that had no UVs on the layout, though the layout fills its first set too', async () => {
		const { document, tiled } = model()
		for (const primitive of tiledPrimitives(document)) {
			primitive.setAttribute('TEXCOORD_0', null)
		}
		const planned = planBakeUvs(document)!

		await writeBakeUvs(planned, await freshWatlas())

		expect(
			tiledPrimitives(document)[0].getAttribute('TEXCOORD_0')
		).not.toBeNull()
		const target = planOcclusionBake(document, {
			layout: planned
		}).targets.find(({ material }) => material === tiled)
		expect(target?.texCoord).toBe(planned.texCoord)
	})

	it('touches no material that bakes on its own UVs', async () => {
		const { document, clean } = model()
		const card = document
			.getRoot()
			.listMeshes()
			.flatMap((mesh) => mesh.listPrimitives())
			.find((primitive) => primitive.getMaterial() === clean)!
		const attributes = card.listAttributes()

		await writeBakeUvs(planBakeUvs(document)!, await freshWatlas())

		expect(card.listAttributes()).toEqual(attributes)
	})

	it('throws when xatlas refuses a part, and changes nothing a part draws', async () => {
		const { document } = model()
		const drawn = () =>
			tiledPrimitives(document).map((primitive) => [
				corners(primitive, 'POSITION'),
				corners(primitive, 'TEXCOORD_0'),
				primitive.getAttribute('TEXCOORD_1')
			])
		const before = drawn()
		const refusing = {
			Initialize: async () => {},
			Atlas: class {
				addMesh() {
					throw new Error('xatlas: invalid mesh')
				}
			}
		}

		await expect(
			writeBakeUvs(planBakeUvs(document)!, refusing as Watlas)
		).rejects.toThrow('xatlas: invalid mesh')
		// Compacted before xatlas sees them, so the same corners, no new set.
		expect(drawn()).toEqual(before)
	})

	it('lays out once per watlas instance, since a second layout drifts', async () => {
		const watlas = await freshWatlas()
		await writeBakeUvs(planBakeUvs(model().document)!, watlas)

		await expect(
			writeBakeUvs(planBakeUvs(model().document)!, watlas)
		).rejects.toThrow('lays out only once')
	})

	it('lays out the same parts the same way in a fresh watlas, so a republish does not change the file', async () => {
		const layout = async () => {
			const { document } = model()
			await writeBakeUvs(planBakeUvs(document)!, await freshWatlas())
			return tiledPrimitives(document).map((primitive) =>
				Array.from(readUvs(primitive, 1)!)
			)
		}

		expect(await layout()).toEqual(await layout())
	})
})

describe('planBakeUvsFor', () => {
	it('lays out no material only a bake that was not asked for takes', async () => {
		const { document, tiled } = model()
		// Occlusion keeps a material's own map; a light map is baked past it.
		tiled.setOcclusionTexture(document.createTexture())

		expect(
			await planBakeUvsFor(document, { occlusion: true, lights: false })
		).toBeUndefined()
		expect(
			(await planBakeUvsFor(document, { occlusion: false, lights: true }))
				?.primitives
		).toHaveLength(2)
	})

	it('lays out no material the light bake skips for another reason when only it was asked for', async () => {
		const { document, tiled } = model()
		tiled.setExtension(
			'KHR_materials_unlit',
			document.createExtension(KHRMaterialsUnlit).createUnlit()
		)

		expect(
			await planBakeUvsFor(document, { occlusion: false, lights: true })
		).toBeUndefined()
		expect(
			(await planBakeUvsFor(document, { occlusion: true, lights: true }))
				?.primitives
		).toHaveLength(2)
	})

	it('finds a set among the parts the bakes asked for take, whatever the others carry', async () => {
		const { document } = model()
		// Every set a viewer reads is in use here, but the light bake skips it.
		const full = document
			.createMaterial('full')
			.setExtension(
				'KHR_materials_unlit',
				document.createExtension(KHRMaterialsUnlit).createUnlit()
			)
		document
			.getRoot()
			.listScenes()[0]
			.addChild(
				document
					.createNode()
					.setTranslation([0, 4, 0])
					.setMesh(document.createMesh().addPrimitive(box(document, full, 3)))
			)

		const planned = await planBakeUvsFor(document, {
			occlusion: false,
			lights: true
		})

		expect(planned?.texCoord).toBe(1)
		expect(planned?.materials.has(full)).toBe(false)
	})

	it('says so for every material when no set is left', async () => {
		const { document, tiled } = model({ extraSets: 3 })

		const planned = await planBakeUvsFor(document, {
			occlusion: true,
			lights: false
		})

		expect(planned?.materials.get(tiled)).toBe('no-free-uv-set')
	})
})
