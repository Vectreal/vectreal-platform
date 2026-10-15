/**
 * Each transform pass runs as itself: it reports its own progress and is
 * recorded under its own name, which the publisher reads back. Called before
 * any model is loaded it says so, rather than finding no document and
 * resolving as if it ran.
 */
import { Document, WebIO } from '@gltf-transform/core'
import { unweld } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'

const SIDE = 10
const GRID_INDICES = (SIDE - 1) * (SIDE - 1) * 6

/**
 * Two primitives on one flat indexed grid, each with its own copy of the
 * index accessor, so every pass has something to remove and leaves the file
 * no larger, which is what gets a pass committed. `normals()` unwelds before
 * anything else, so it grows any welded model; it gets the grid unwelded.
 */
async function gridGlb({
	welded = true,
	normal = [0, 0, 1]
} = {}): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const positions: number[] = []
	const normals: number[] = []
	const indices: number[] = []
	for (let y = 0; y < SIDE; y++) {
		for (let x = 0; x < SIDE; x++) {
			positions.push(x / (SIDE - 1), y / (SIDE - 1), 0)
			normals.push(...normal)
			if (x < SIDE - 1 && y < SIDE - 1) {
				const i = y * SIDE + x
				indices.push(i, i + 1, i + SIDE, i + 1, i + SIDE + 1, i + SIDE)
			}
		}
	}
	const vec3 = (array: number[]) =>
		document.createAccessor().setType('VEC3').setArray(new Float32Array(array))
	const position = vec3(positions)
	const normalAccessor = vec3(normals)
	const primitive = () =>
		document
			.createPrimitive()
			.setAttribute('POSITION', position)
			.setAttribute('NORMAL', normalAccessor)
			.setIndices(
				document
					.createAccessor()
					.setType('SCALAR')
					.setArray(new Uint16Array(indices))
			)
	const mesh = document
		.createMesh()
		.addPrimitive(primitive())
		.addPrimitive(primitive())
	document.createScene().addChild(document.createNode().setMesh(mesh))
	if (!welded) await document.transform(unweld())
	return new WebIO().writeBinary(document)
}

const primitives = (document: Document) =>
	document
		.getRoot()
		.listMeshes()
		.flatMap((mesh) => mesh.listPrimitives())

const PASSES = [
	{
		method: 'simplify',
		run: (optimizer: ModelOptimizer) => optimizer.simplify(),
		name: 'simplification',
		progress: ['Applying mesh simplification', 'Mesh simplification complete'],
		fixture: {},
		effect: (document: Document) => {
			const indices = primitives(document).map(
				(primitive) => primitive.getIndices()?.getCount() ?? 0
			)
			expect(Math.max(...indices)).toBeLessThan(GRID_INDICES)
		}
	},
	{
		method: 'deduplicate',
		run: (optimizer: ModelOptimizer) => optimizer.deduplicate(),
		name: 'deduplication',
		progress: ['Applying deduplication', 'Deduplication complete'],
		fixture: {},
		// Quantizing also merges the copies, but leaves no float positions.
		effect: (document: Document) => {
			const [first, second] = primitives(document)
			expect(first.getIndices()).toBe(second.getIndices())
			expect(first.getAttribute('POSITION')?.getComponentSize()).toBe(4)
		}
	},
	{
		method: 'quantize',
		run: (optimizer: ModelOptimizer) => optimizer.quantize(),
		name: 'quantization',
		progress: ['Applying quantization', 'Quantization complete'],
		fixture: {},
		effect: (document: Document) => {
			const position = primitives(document)[0].getAttribute('POSITION')
			expect(position?.getComponentSize()).toBeLessThan(4)
		}
	},
	// Its options reach the transform: without `overwrite` it leaves the
	// sideways normals the fixture gives it alone.
	{
		method: 'optimizeNormals',
		run: (optimizer: ModelOptimizer) =>
			optimizer.optimizeNormals({ overwrite: true }),
		name: 'normals optimization',
		progress: ['Optimizing normals', 'Normals optimization complete'],
		fixture: { welded: false, normal: [1, 0, 0] },
		effect: (document: Document) => {
			const normal = primitives(document)[0].getAttribute('NORMAL')
			expect(normal?.getElement(0, [])).toEqual([0, 0, 1])
		}
	}
]

describe('ModelOptimizer transform passes', () => {
	it.each(PASSES)(
		'$method runs its own pass and records it as $name',
		async ({ run, name, progress, fixture, effect }) => {
			const optimizer = new ModelOptimizer()
			await optimizer.loadFromBuffer(await gridGlb(fixture))
			const reported: string[] = []
			optimizer.onProgress(({ operation }) => reported.push(operation))

			await run(optimizer)

			expect(optimizer.getAppliedOptimizations()).toEqual([name])
			expect(reported).toEqual(progress)
			effect(optimizer.document)
		}
	)

	it.each(PASSES)(
		'$method refuses to run before a model is loaded',
		async ({ run }) => {
			await expect(run(new ModelOptimizer())).rejects.toThrow('No model loaded')
		}
	)
})
