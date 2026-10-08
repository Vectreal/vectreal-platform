/**
 * Each transform pass runs as itself: it reports its own progress and is
 * recorded under its own name, which the publisher reads back. Called before
 * any model is loaded it says so, rather than finding no document and
 * resolving as if it ran.
 */
import { Accessor, Document, WebIO } from '@gltf-transform/core'
import { unweld } from '@gltf-transform/functions'
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'

const SIDE = 10

/**
 * A flat indexed grid whose index accessor is duplicated, so every pass
 * leaves the file no larger and is committed. `normals()` unwelds before
 * anything else, so it grows any welded model; it gets the grid unwelded.
 */
async function gridGlb({ welded = true } = {}): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const positions: number[] = []
	const indices: number[] = []
	for (let y = 0; y < SIDE; y++) {
		for (let x = 0; x < SIDE; x++) {
			positions.push(x / (SIDE - 1), y / (SIDE - 1), 0)
			if (x < SIDE - 1 && y < SIDE - 1) {
				const i = y * SIDE + x
				indices.push(i, i + 1, i + SIDE, i + 1, i + SIDE + 1, i + SIDE)
			}
		}
	}
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array(positions))
	const normal = document
		.createAccessor()
		.setType('VEC3')
		.setArray(
			new Float32Array(positions.length).map((_, i) => (i % 3 === 2 ? 1 : 0))
		)
	const primitive = (index: Accessor) =>
		document
			.createPrimitive()
			.setAttribute('POSITION', position)
			.setAttribute('NORMAL', normal)
			.setIndices(index)
	const indexAccessor = () =>
		document
			.createAccessor()
			.setType('SCALAR')
			.setArray(new Uint16Array(indices))
	const mesh = document
		.createMesh()
		.addPrimitive(primitive(indexAccessor()))
		.addPrimitive(primitive(indexAccessor()))
	document.createScene().addChild(document.createNode().setMesh(mesh))
	if (!welded) await document.transform(unweld())
	return new WebIO().writeBinary(document)
}

const PASSES = [
	{
		method: 'simplify',
		run: (optimizer: ModelOptimizer) => optimizer.simplify(),
		name: 'simplification',
		progress: ['Applying mesh simplification', 'Mesh simplification complete']
	},
	{
		method: 'deduplicate',
		run: (optimizer: ModelOptimizer) => optimizer.deduplicate(),
		name: 'deduplication',
		progress: ['Applying deduplication', 'Deduplication complete']
	},
	{
		method: 'quantize',
		run: (optimizer: ModelOptimizer) => optimizer.quantize(),
		name: 'quantization',
		progress: ['Applying quantization', 'Quantization complete']
	},
	{
		method: 'optimizeNormals',
		run: (optimizer: ModelOptimizer) => optimizer.optimizeNormals(),
		name: 'normals optimization',
		progress: ['Optimizing normals', 'Normals optimization complete'],
		welded: false
	}
]

describe('ModelOptimizer transform passes', () => {
	it.each(PASSES)(
		'$method runs its own pass and records it as $name',
		async ({ run, name, progress, welded }) => {
			const optimizer = new ModelOptimizer()
			await optimizer.loadFromBuffer(await gridGlb({ welded }))
			const reported: string[] = []
			optimizer.onProgress(({ operation }) => reported.push(operation))

			await run(optimizer)

			expect(optimizer.getAppliedOptimizations()).toEqual([name])
			expect(reported).toEqual(progress)
		}
	)

	it.each(PASSES)(
		'$method refuses to run before a model is loaded',
		async ({ run }) => {
			await expect(run(new ModelOptimizer())).rejects.toThrow('No model loaded')
		}
	)
})
