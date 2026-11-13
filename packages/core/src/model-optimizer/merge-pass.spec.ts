/**
 * Mesh merging joins parts that share a material, and leaves alone every
 * part a scene or a clip still needs as itself: an animated node and whatever
 * hangs below it, a skinned mesh, a morphing one. Every part keeps where it
 * stands in the world, so a hotspot placed on its surface still lands there.
 */
import { Document, Node, Primitive, WebIO } from '@gltf-transform/core'
import {
	KHRLightsPunctual,
	KHRMaterialsVariants,
	KHRMaterialsVolume,
	KHRNodeVisibility
} from '@gltf-transform/extensions'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ModelOptimizer } from './model-optimizer'
import { placeStillParts } from './transform-passes'
import { IO_EXTENSIONS } from '../io-extensions'
import { Lightmap, VectrealLightmap } from '../light-bake/extension'
import { LIGHTMAP_EXTENSION } from '../scene-lighting/baked-lights'

import type { MockInstance } from 'vitest'

/** A one-pixel PNG, for a texture loading has to read. */
const PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
	),
	(char) => char.charCodeAt(0)
)

/** Reads and writes what the optimizer does, Vectreal's own extensions included. */
const io = new WebIO().registerExtensions(IO_EXTENSIONS)

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/** A unit triangle, so every part is one draw call of its own. */
function triangle(document: Document) {
	const accessor = (type: 'VEC3' | 'SCALAR', values: number[]) =>
		document.createAccessor().setType(type).setArray(new Float32Array(values))
	return document
		.createPrimitive()
		.setAttribute('POSITION', accessor('VEC3', [0, 0, 0, 1, 0, 0, 0, 1, 0]))
		.setAttribute('NORMAL', accessor('VEC3', [0, 0, 1, 0, 0, 1, 0, 0, 1]))
}

/**
 * A scene of parts nested up to three levels deep, each placed somewhere of
 * its own, on two materials. `extend` adds to it before it is written.
 */
async function partsGlb(
	extend: (document: Document, group: Node) => void = () => undefined
): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const paint = document.createMaterial('paint')
	const chrome = document.createMaterial('chrome')
	const group = document.createNode('body').setTranslation([5, 0, 0])
	// One paint part a level deeper, so it joins the others only once the
	// hierarchy is flattened.
	const trim = document
		.createNode('trim')
		.setRotation([0, 0.7071068, 0, 0.7071068])
	group.addChild(trim)
	document.createScene().addChild(group)
	for (let i = 0; i < 4; i++) {
		const primitive = triangle(document).setMaterial(i < 3 ? paint : chrome)
		;(i === 2 ? trim : group).addChild(
			document
				.createNode(`part-${i}`)
				.setTranslation([i, i, 0])
				.setMesh(document.createMesh(`part-${i}`).addPrimitive(primitive))
		)
	}
	extend(document, group)
	return io.writeBinary(document)
}

const drawCalls = (document: Document) =>
	document
		.getRoot()
		.listNodes()
		.reduce(
			(count, node) => count + (node.getMesh()?.listPrimitives().length ?? 0),
			0
		)

/** Every vertex's world position, sorted so the order parts sit in is moot. */
const worldVertices = (document: Document) =>
	document
		.getRoot()
		.listNodes()
		.flatMap((node) => {
			const matrix = node.getWorldMatrix()
			return (node.getMesh()?.listPrimitives() ?? []).flatMap((primitive) => {
				const position = primitive.getAttribute('POSITION')!
				return Array.from({ length: position.getCount() }, (_, i) => {
					const [x, y, z] = position.getElement(i, [0, 0, 0])
					return [0, 1, 2].map(
						(row) =>
							matrix[row] * x +
							matrix[row + 4] * y +
							matrix[row + 8] * z +
							matrix[row + 12]
					)
				})
			})
		})
		.map((vertex) => vertex.map((value) => Math.round(value * 1e4) / 1e4))
		.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])

function expectSameVertices(after: number[][], before: number[][]) {
	expect(after).toHaveLength(before.length)
	// Moving vertices between spaces rounds in the last digits.
	after.forEach((vertex, i) =>
		vertex.forEach((value, axis) =>
			expect(value).toBeCloseTo(before[i][axis], 5)
		)
	)
}

/** What each mesh draws, by name: its material, transform and arrays. */
const contents = (document: Document) =>
	Object.fromEntries(
		document
			.getRoot()
			.listNodes()
			.filter((node) => node.getMesh())
			.map((node) => [
				node.getName(),
				{
					matrix: node.getMatrix(),
					primitives: node
						.getMesh()!
						.listPrimitives()
						.map((primitive) => ({
							material: primitive.getMaterial()?.getName(),
							indices: Array.from(primitive.getIndices()?.getArray() ?? []),
							attributes: Object.fromEntries(
								primitive
									.listSemantics()
									.map((semantic) => [
										semantic,
										Array.from(primitive.getAttribute(semantic)!.getArray()!)
									])
							)
						}))
				}
			])
	)

/** A paint part whose one triangle carries a tangent along +X. */
function withTangent(document: Document, name: string) {
	const primitive = triangle(document)
		.setAttribute(
			'TANGENT',
			document
				.createAccessor()
				.setType('VEC4')
				.setArray(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]))
		)
		.setMaterial(document.getRoot().listMaterials()[0])
	return document
		.createNode(name)
		.setMesh(document.createMesh(name).addPrimitive(primitive))
}

/** Every tangent in the scene, rounded, as the merged nodes stand at the origin. */
const tangents = (document: Document) =>
	document
		.getRoot()
		.listMeshes()
		.flatMap((mesh) => mesh.listPrimitives())
		.flatMap((primitive) => {
			const tangent = primitive.getAttribute('TANGENT')
			if (!tangent) return []
			return Array.from({ length: tangent.getCount() }, (_, i) =>
				tangent
					.getElement(i, [0, 0, 0, 0])
					.map((value) => Math.round(value) + 0)
			)
		})

/**
 * For each triangle, whether it shows its front: its winding agrees with its
 * normal in the world. three.js turns the front face of a mirrored node
 * around, so there a disagreement is what shows the front.
 */
const facing = (document: Document) =>
	document
		.getRoot()
		.listNodes()
		.flatMap((node) => {
			const m = node.getWorldMatrix()
			const linear = (v: number[], matrix: number[], stride: number) =>
				[0, 1, 2].map(
					(row) =>
						matrix[row] * v[0] +
						matrix[row + stride] * v[1] +
						matrix[row + 2 * stride] * v[2]
				)
			const [a, b, c, , d, e, f, , g, h, k] = m
			const cofactors = [
				e * k - f * h,
				f * g - d * k,
				d * h - e * g,
				c * h - b * k,
				a * k - c * g,
				b * g - a * h,
				b * f - c * e,
				c * d - a * f,
				a * e - b * d
			]
			const determinant = a * cofactors[0] + b * cofactors[1] + c * cofactors[2]
			const mirrored = determinant < 0
			return (node.getMesh()?.listPrimitives() ?? []).flatMap((primitive) => {
				const position = primitive.getAttribute('POSITION')!
				const normal = primitive.getAttribute('NORMAL')!
				const indices =
					primitive.getIndices()?.getArray() ??
					Array.from({ length: position.getCount() }, (_, i) => i)
				const result: boolean[] = []
				for (let i = 0; i + 2 < indices.length; i += 3) {
					const [p, q, r] = [0, 1, 2].map((corner) =>
						linear(position.getElement(indices[i + corner], [0, 0, 0]), m, 4)
					)
					const u = [0, 1, 2].map((axis) => q[axis] - p[axis])
					const v = [0, 1, 2].map((axis) => r[axis] - p[axis])
					const cross = [
						u[1] * v[2] - u[2] * v[1],
						u[2] * v[0] - u[0] * v[2],
						u[0] * v[1] - u[1] * v[0]
					]
					const n = linear(
						normal.getElement(indices[i], [0, 0, 0]),
						cofactors,
						3
					)
					const agrees =
						(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2]) *
							Math.sign(determinant) >
						0
					result.push(agrees !== mirrored)
				}
				return result
			})
		})

const nodeNamed = (document: Document, name: string) =>
	document
		.getRoot()
		.listNodes()
		.find((node) => node.getName() === name)

async function merged(glb: Uint8Array) {
	const optimizer = new ModelOptimizer()
	await optimizer.loadFromBuffer(glb)
	const before = optimizer.document
	const beforeDrawCalls = drawCalls(before)
	const beforeBytes = (await io.writeBinary(before)).byteLength
	await optimizer.mergeMeshes()
	return {
		document: optimizer.document,
		applied: optimizer.getAppliedOptimizations(),
		beforeDrawCalls,
		beforeBytes
	}
}

const REVERTED = /^mesh merging made no improvement worth keeping \(/

describe('mesh merging', () => {
	/*
	  A merge that saves nothing is reverted, and the optimizer says so on
	  console.warn. That is the only warning this pass may give.
	*/
	let warn: MockInstance<typeof console.warn>
	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	})
	afterEach(() => {
		for (const [message] of warn.mock.calls) expect(message).toMatch(REVERTED)
	})

	it('joins parts that share a material into one draw each', async () => {
		const { document, applied, beforeDrawCalls } = await merged(
			await partsGlb()
		)

		expect(beforeDrawCalls).toBe(4)
		expect(drawCalls(document)).toBe(2)
		expect(applied).toEqual(['mesh merging'])
	})

	// A model already quantized, by gltfpack for one, would come out as floats
	// for no fewer draws.
	it('leaves a model with nothing to merge exactly as it was', async () => {
		const glb = await (async () => {
			const document = new Document()
			document.createBuffer()
			const scene = document.createScene()
			for (const name of ['paint', 'chrome']) {
				const primitive = triangle(document)
					.setAttribute(
						'POSITION',
						document
							.createAccessor()
							.setType('VEC3')
							.setArray(new Int16Array([0, 0, 0, 32767, 0, 0, 0, 32767, 0]))
							.setNormalized(true)
					)
					.setMaterial(document.createMaterial(name))
				scene.addChild(
					document
						.createNode(name)
						.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2])
						.setMesh(document.createMesh(name).addPrimitive(primitive))
				)
			}
			// A part no scene shows, which pruning drops: no fewer draws.
			document
				.createNode('orphan')
				.setMesh(
					document
						.createMesh('orphan')
						.addPrimitive(
							triangle(document).setMaterial(document.createMaterial('spare'))
						)
				)
			return io.writeBinary(document)
		})()

		const { document, applied } = await merged(glb)

		expect(applied).toEqual([])
		expect(warn).toHaveBeenCalledWith(expect.stringMatching(REVERTED))
		for (const primitive of ['paint', 'chrome'].flatMap((name) =>
			nodeNamed(document, name)!.getMesh()!.listPrimitives()
		)) {
			expect(primitive.getAttribute('POSITION')?.getComponentSize()).toBe(2)
		}
	})

	// Optimizing a scene again runs the pass on what it already merged.
	it('changes nothing on a model it already merged', async () => {
		const once = new ModelOptimizer()
		await once.loadFromBuffer(await partsGlb())
		await once.mergeMeshes()
		const mergedGlb = await once.export()

		const twice = new ModelOptimizer()
		await twice.loadFromBuffer(mergedGlb)
		await twice.mergeMeshes()

		expect(warn).toHaveBeenCalledWith(expect.stringMatching(REVERTED))
		expect(drawCalls(twice.document)).toBe(drawCalls(once.document))
		expectSameVertices(
			worldVertices(twice.document),
			worldVertices(once.document)
		)
		// Byte for byte it may differ: `join` rewrites the accessors of every
		// part it could join, in the order it meets them.
		expect(contents(twice.document)).toEqual(contents(once.document))
	})

	// A viewer measures a mesh by its own box carried through its node, so a
	// merged mesh under a rotated node would measure larger than it is.
	it('stands every merged mesh at the origin, so its box is its own', async () => {
		const { document } = await merged(await partsGlb())

		for (const node of document.getRoot().listNodes()) {
			if (node.getMesh()) expect(node.getMatrix()).toEqual(IDENTITY)
		}
	})

	it('leaves every vertex where it stood in the world', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await partsGlb())
		const before = worldVertices(optimizer.document)

		await optimizer.mergeMeshes()

		expectSameVertices(worldVertices(optimizer.document), before)
	})

	// Merging is for draw calls, not bytes: a mesh shared by several nodes
	// becomes one copy per use, and the result is still kept.
	it('is kept when it makes the file larger', async () => {
		const glb = await partsGlb((document, group) => {
			// A bolt of a few hundred vertices, so its copies outweigh the
			// nodes merging removes.
			const vertices = new Float32Array(300 * 3).map((_, i) => i % 7)
			const bolt = triangle(document)
				.setAttribute(
					'POSITION',
					document.createAccessor().setType('VEC3').setArray(vertices)
				)
				.setAttribute(
					'NORMAL',
					document.createAccessor().setType('VEC3').setArray(vertices)
				)
				.setMaterial(document.getRoot().listMaterials()[0])
			const shared = document.createMesh('bolt').addPrimitive(bolt)
			for (let i = 0; i < 8; i++) {
				group.addChild(
					document
						.createNode(`bolt-${i}`)
						.setTranslation([0, 0, i])
						.setMesh(shared)
				)
			}
		})
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(glb)
		const before = worldVertices(optimizer.document)
		const { document, applied, beforeBytes } = await merged(glb)

		// Every bolt stays where it stood, though they shared one mesh.
		expectSameVertices(worldVertices(document), before)

		const afterBytes = (await io.writeBinary(document)).byteLength
		expect(afterBytes).toBeGreaterThan(beforeBytes)
		expect(applied).toEqual(['mesh merging'])
		expect(drawCalls(document)).toBe(2)
	})

	// Quantized normals are stored as normalized integers, which a part's
	// rotation has to be decoded from and written back into.
	it('turns a quantized normal with its part', async () => {
		const glb = await partsGlb((document, group) => {
			const quarterTurn = [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const
			const part = triangle(document)
				.setAttribute(
					'NORMAL',
					document
						.createAccessor()
						.setType('VEC3')
						.setArray(new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]))
						.setNormalized(true)
				)
				.setMaterial(document.getRoot().listMaterials()[1])
			group.addChild(
				document
					.createNode('turned')
					.setRotation([...quarterTurn])
					.setMesh(document.createMesh('turned').addPrimitive(part))
			)
		})
		const { document } = await merged(glb)

		const normals = document
			.getRoot()
			.listMeshes()
			.flatMap((mesh) => mesh.listPrimitives())
			.flatMap((primitive) => {
				const normal = primitive.getAttribute('NORMAL')!
				return Array.from({ length: normal.getCount() }, (_, i) =>
					normal.getElement(i, [0, 0, 0])
				)
			})
		// No normal is zeroed, and the turned part's three, like the trim's,
		// point along +X after a quarter turn about Y.
		for (const normal of normals) {
			expect(Math.hypot(...normal)).toBeCloseTo(1, 2)
		}
		expect(normals.filter(([x]) => x > 0.99)).toHaveLength(6)
	})

	// A published file read back in carries its baked lights: one texture per
	// material, sampled through each vertex's first UV set.
	it('keeps every vertex reading the lightmap where it did', async () => {
		const glb = await partsGlb((document) => {
			const paint = document.getRoot().listMaterials()[0]
			const texture = document
				.createTexture('baked')
				.setMimeType('image/png')
				.setImage(PIXEL_PNG)
			paint.setExtension(
				LIGHTMAP_EXTENSION,
				document
					.createExtension(VectrealLightmap)
					.createLightmap()
					.setTexture(texture)
					.setScale(2)
					.setSignature('v1:baked')
			)
			// Each paint part reads its own corner of the map.
			document
				.getRoot()
				.listMeshes()
				.filter((mesh) => mesh.listPrimitives()[0].getMaterial() === paint)
				.forEach((mesh, part) =>
					mesh.listPrimitives()[0].setAttribute(
						'TEXCOORD_0',
						document
							.createAccessor()
							.setType('VEC2')
							.setArray(
								new Float32Array(
									[0, 0, 0.1, 0, 0, 0.1].map((uv) => uv + part / 4)
								)
							)
					)
				)
		})
		const uvsByPosition = (document: Document) =>
			document
				.getRoot()
				.listNodes()
				.flatMap((node) => {
					const matrix = node.getWorldMatrix()
					return (node.getMesh()?.listPrimitives() ?? []).flatMap(
						(primitive) => {
							const uv = primitive.getAttribute('TEXCOORD_0')
							if (!uv) return []
							const position = primitive.getAttribute('POSITION')!
							return Array.from({ length: position.getCount() }, (_, i) => {
								const [x, y, z] = position.getElement(i, [0, 0, 0])
								const world = [0, 1, 2].map(
									(row) =>
										matrix[row] * x +
										matrix[row + 4] * y +
										matrix[row + 8] * z +
										matrix[row + 12]
								)
								return [...world, ...uv.getElement(i, [0, 0])]
									.map((value) => value.toFixed(4))
									.join(',')
							})
						}
					)
				})
				.sort()
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(glb)
		const before = uvsByPosition(optimizer.document)

		const { document } = await merged(glb)

		expect(before).toHaveLength(9)
		expect(uvsByPosition(document)).toEqual(before)
		const paint = document
			.getRoot()
			.listMaterials()
			.find((material) => material.getName() === 'paint')!
		const lightmap = paint.getExtension<Lightmap>(LIGHTMAP_EXTENSION)!
		expect(lightmap.getTexture()!.getImage()).toEqual(PIXEL_PNG)
		expect(lightmap.getScale()).toBe(2)
		expect(lightmap.getSignature()).toBe('v1:baked')
		expect(drawCalls(document)).toBe(2)
	})

	// glTF-Transform 4.4.2 rotates a tangent from its own half-written result,
	// so the pass moves vertices itself.
	it('turns a tangent with its part', async () => {
		const { document } = await merged(
			await partsGlb((document, group) =>
				group.addChild(
					withTangent(document, 'turned').setRotation([
						0,
						Math.SQRT1_2,
						0,
						Math.SQRT1_2
					])
				)
			)
		)

		// A quarter turn about Y points +X along -Z; the body's own turn is a
		// translation, so the tangent reads in world space as it is stored.
		expect(tangents(document)).toContainEqual([0, 0, -1, 1])
	})

	// The common CAD case: one side of a model mirrored from the other.
	it('joins a mirrored part with the unmirrored ones, still facing out', async () => {
		const glb = await partsGlb((document, group) =>
			group.addChild(
				document
					.createNode('left')
					.setScale([-1, 1, 1])
					.setMesh(
						document
							.createMesh('left')
							.addPrimitive(
								triangle(document).setMaterial(
									document.getRoot().listMaterials()[0]
								)
							)
					)
			)
		)
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(glb)
		const facingBefore = facing(optimizer.document)

		const { document } = await merged(glb)

		expect(drawCalls(document)).toBe(2)
		expect(facing(document)).toEqual(facingBefore)
	})

	// Placement is exported on its own, with no prune after it to tidy up.
	it('leaves nothing behind that writing a file would trip on', async () => {
		const document = new Document()
		document.createBuffer()
		document.createScene().addChild(
			document
				.createNode('left')
				.setScale([-1, 1, 1])
				.setMesh(document.createMesh('left').addPrimitive(triangle(document)))
		)

		await document.transform(placeStillParts())

		await expect(io.writeBinary(document)).resolves.toBeInstanceOf(Uint8Array)
	})

	it('keeps a mirrored part facing out, its tangent flipped', async () => {
		const glb = await partsGlb((document, group) =>
			group.addChild(withTangent(document, 'mirrored').setScale([-1, 1, 1]))
		)
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(glb)
		const facingBefore = facing(optimizer.document)

		const { document } = await merged(glb)

		expect(facing(document)).toEqual(facingBefore)
		expect(tangents(document)).toContainEqual([-1, 0, 0, -1])
	})

	it.each([
		{
			what: 'a node carrying a light',
			add: (document: Document, node: Node) =>
				node.setExtension(
					'KHR_lights_punctual',
					document.createExtension(KHRLightsPunctual).createLight()
				)
		},
		{
			what: 'a node carrying a camera',
			add: (document: Document, node: Node) =>
				node.setCamera(document.createCamera())
		},
		{
			what: 'a volume material, whose thickness is in its own space',
			add: (document: Document, node: Node) =>
				node
					.getMesh()!
					.listPrimitives()[0]
					.getMaterial()!
					.setExtension(
						'KHR_materials_volume',
						document.createExtension(KHRMaterialsVolume).createVolume()
					)
		},
		{
			what: 'a mirrored strip, whose winding cannot be turned',
			add: (_document: Document, node: Node) => {
				node.setScale([-1, 1, 1])
				node
					.getMesh()!
					.listPrimitives()[0]
					.setMode(Primitive.Mode['TRIANGLE_STRIP'])
			}
		}
	])('leaves $what as it is', async ({ add }) => {
		const { document } = await merged(
			await partsGlb((document, group) => {
				const kept = document
					.createNode('kept')
					.setTranslation([0, 0, 4])
					.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2])
					.setMesh(
						document
							.createMesh('kept')
							.addPrimitive(
								triangle(document).setMaterial(
									document.getRoot().listMaterials()[0]
								)
							)
					)
				add(document, kept)
				group.addChild(kept)
			})
		)

		const kept = nodeNamed(document, 'kept')
		kept!
			.getRotation()
			.forEach((value, i) =>
				expect(value).toBeCloseTo([0, Math.SQRT1_2, 0, Math.SQRT1_2][i], 6)
			)
		expect(kept?.getMesh()?.listPrimitives()).toHaveLength(1)
	})

	it('keeps a hidden part out of the parts it would otherwise join', async () => {
		const { document } = await merged(
			await partsGlb((document) => {
				// At the origin, where joining needs nothing moved.
				const hidden = document
					.createNode('hidden')
					.setMesh(
						document
							.createMesh('hidden')
							.addPrimitive(
								triangle(document).setMaterial(
									document.getRoot().listMaterials()[0]
								)
							)
					)
					.setExtension(
						'KHR_node_visibility',
						document
							.createExtension(KHRNodeVisibility)
							.createVisibility()
							.setVisible(false)
					)
				document.getRoot().listScenes()[0].addChild(hidden)
			})
		)

		expect(
			nodeNamed(document, 'hidden')?.getMesh()?.listPrimitives()
		).toHaveLength(1)
		expect(drawCalls(document)).toBe(3)
	})

	it('keeps what a mesh carries when it moves the part', async () => {
		const { document } = await merged(
			await partsGlb((document, group) =>
				group.addChild(
					document
						.createNode('labelled')
						.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2])
						.setMesh(
							document
								.createMesh('labelled')
								.setExtras({ partNumber: 'A-113' })
								.addPrimitive(
									// A material of its own, so nothing joins it.
									triangle(document).setMaterial(
										document.createMaterial('badge')
									)
								)
						)
				)
			)
		)

		expect(nodeNamed(document, 'labelled')?.getMesh()?.getExtras()).toEqual({
			partNumber: 'A-113'
		})
	})

	// Joining builds new primitives and would drop each one's extensions.
	it('keeps a part with material variants out of any join', async () => {
		const { document } = await merged(
			await partsGlb((document, group) => {
				const variants = document.createExtension(KHRMaterialsVariants)
				// The same layout as the other paint parts, so only its variants
				// keep it from joining them.
				const node = document
					.createNode('configurable')
					.setMesh(
						document
							.createMesh('configurable')
							.addPrimitive(
								triangle(document).setMaterial(
									document.getRoot().listMaterials()[0]
								)
							)
					)
				node
					.getMesh()!
					.listPrimitives()[0]
					.setExtension(
						'KHR_materials_variants',
						variants
							.createMappingList()
							.addMapping(
								variants
									.createMapping()
									.setMaterial(document.getRoot().listMaterials()[1])
									.addVariant(variants.createVariant('chrome'))
							)
					)
				group.addChild(node)
			})
		)

		const [primitive] = nodeNamed(document, 'configurable')!
			.getMesh()!
			.listPrimitives()
		expect(primitive.getExtension('KHR_materials_variants')).not.toBeNull()
		// The other paint parts still merged without it.
		expect(drawCalls(document)).toBe(3)
	})

	// Each one turned, so moving its transform into its vertices would show:
	// a clip writes the node's transform over it, a skin binds the vertices
	// where they stand, and morph targets would stay in the old space.
	it.each([
		{
			what: 'an animated part with nothing below it',
			add: (document: Document, node: Node) => {
				const sampler = document
					.createAnimationSampler()
					.setInput(
						document
							.createAccessor()
							.setType('SCALAR')
							.setArray(new Float32Array([0, 1]))
					)
					.setOutput(
						document
							.createAccessor()
							.setType('VEC3')
							.setArray(new Float32Array([0, 0, 0, 0, 2, 0]))
					)
				document
					.createAnimation('lift')
					.addSampler(sampler)
					.addChannel(
						document
							.createAnimationChannel()
							.setTargetNode(node)
							.setTargetPath('translation')
							.setSampler(sampler)
					)
			}
		},
		{
			what: 'a skinned part',
			add: (document: Document, node: Node) =>
				node.setSkin(
					document.createSkin().addJoint(document.createNode('bone'))
				)
		},
		{
			what: 'a morphing part',
			add: (document: Document, node: Node) =>
				node
					.getMesh()!
					.listPrimitives()[0]
					.addTarget(
						document.createPrimitiveTarget().setAttribute(
							'POSITION',
							document
								.createAccessor()
								.setType('VEC3')
								.setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]))
						)
					)
		}
	])('keeps the transform of $what', async ({ add }) => {
		const quarterTurn = [0, Math.SQRT1_2, 0, Math.SQRT1_2]
		const { document } = await merged(
			await partsGlb((document) => {
				const moving = document
					.createNode('moving')
					.setRotation(quarterTurn as [number, number, number, number])
					.setMesh(
						document
							.createMesh('moving')
							.addPrimitive(
								triangle(document).setMaterial(
									document.getRoot().listMaterials()[0]
								)
							)
					)
				add(document, moving)
				// At the scene root, where flattening leaves it to the pass to judge.
				document.getRoot().listScenes()[0].addChild(moving)
			})
		)

		const moving = nodeNamed(document, 'moving')!
		moving
			.getRotation()
			.forEach((value, i) => expect(value).toBeCloseTo(quarterTurn[i], 6))
	})

	// `join` would put primitive-restart indices between them, which three.js
	// reads as vertices.
	it('joins no strips', async () => {
		const strip = (document: Document, name: string) =>
			document
				.createNode(name)
				.setMesh(
					document
						.createMesh(name)
						.addPrimitive(
							triangle(document)
								.setMaterial(document.getRoot().listMaterials()[1])
								.setMode(Primitive.Mode['TRIANGLE_STRIP'])
						)
				)
		const { document, applied } = await merged(
			await partsGlb((document) => {
				const scene = document.getRoot().listScenes()[0]
				scene
					.addChild(strip(document, 'strip-a'))
					.addChild(strip(document, 'strip-b'))
			})
		)

		expect(
			nodeNamed(document, 'strip-a')?.getMesh()?.listPrimitives()
		).toHaveLength(1)
		expect(
			nodeNamed(document, 'strip-b')?.getMesh()?.listPrimitives()
		).toHaveLength(1)
		expect(applied).toEqual(['mesh merging'])
	})

	it('leaves an animated node, and the parts below it, as themselves', async () => {
		const glb = await partsGlb((document, group) => {
			const paint = document.getRoot().listMaterials()[0]
			const door = document
				.createNode('door')
				.setMesh(
					document
						.createMesh('door')
						.addPrimitive(triangle(document).setMaterial(paint))
				)
			const handle = document
				.createNode('handle')
				.setTranslation([0, 1, 0])
				.setMesh(
					document
						.createMesh('handle')
						.addPrimitive(triangle(document).setMaterial(paint))
				)
			door.addChild(handle)
			group.addChild(door)
			const sampler = document
				.createAnimationSampler()
				.setInput(
					document
						.createAccessor()
						.setType('SCALAR')
						.setArray(new Float32Array([0, 1]))
				)
				.setOutput(
					document
						.createAccessor()
						.setType('VEC3')
						.setArray(new Float32Array([0, 0, 0, 0, 2, 0]))
				)
			document
				.createAnimation('open')
				.addSampler(sampler)
				.addChannel(
					document
						.createAnimationChannel()
						.setTargetNode(door)
						.setTargetPath('translation')
						.setSampler(sampler)
				)
		})
		const { document } = await merged(glb)

		const door = nodeNamed(document, 'door')
		const handle = nodeNamed(document, 'handle')
		const [channel] = document.getRoot().listAnimations()[0].listChannels()
		expect(channel.getTargetNode()).toBe(door)
		expect(door?.getMesh()?.listPrimitives()).toHaveLength(1)
		expect(handle?.getParentNode()).toBe(door)
		expect(handle?.getMesh()?.listPrimitives()).toHaveLength(1)
		// The still parts on the same material merged without them.
		expect(drawCalls(document)).toBe(4)
	})

	it('leaves a skinned mesh as itself', async () => {
		const glb = await partsGlb((document, group) => {
			const paint = document.getRoot().listMaterials()[0]
			// A joint the skin bends around, holding a part of its own.
			const joint = document
				.createNode('joint')
				.setTranslation([0, 2, 0])
				.setMesh(
					document
						.createMesh('joint')
						.addPrimitive(triangle(document).setMaterial(paint))
				)
			const skinned = document
				.createNode('skinned')
				.setMesh(
					document
						.createMesh('skinned')
						.addPrimitive(triangle(document).setMaterial(paint))
				)
				.setSkin(document.createSkin().addJoint(joint))
			group.addChild(joint).addChild(skinned)
		})
		const { document } = await merged(glb)

		expect(
			nodeNamed(document, 'skinned')?.getMesh()?.listPrimitives()
		).toHaveLength(1)
		// The skin is bound to the joint where it stands, so it keeps its own
		// transform rather than handing it to its vertices.
		expect(nodeNamed(document, 'joint')?.getTranslation()).toEqual([5, 2, 0])
	})

	it('leaves a morphing mesh as itself', async () => {
		const glb = await partsGlb((document, group) => {
			const paint = document.getRoot().listMaterials()[0]
			const target = document.createPrimitiveTarget().setAttribute(
				'POSITION',
				document
					.createAccessor()
					.setType('VEC3')
					.setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]))
			)
			group.addChild(
				document
					.createNode('morphing')
					.setMesh(
						document
							.createMesh('morphing')
							.addPrimitive(
								triangle(document).setMaterial(paint).addTarget(target)
							)
					)
			)
		})
		const { document } = await merged(glb)

		expect(
			nodeNamed(document, 'morphing')?.getMesh()?.listPrimitives()
		).toHaveLength(1)
		expect(drawCalls(document)).toBe(3)
	})
})
