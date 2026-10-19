/**
 * Placement stands a model on the ground at the origin, at a real-world size
 * when one is given, and is kept although the node it adds grows the file.
 */
import { Document, getBounds, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'

/** A 2 x 4 x 1 box whose corner sits at (10, 5, -3), off the origin as generated models arrive. */
async function offsetBoxGlb(): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const corners: number[] = []
	for (const x of [0, 2])
		for (const y of [0, 4]) for (const z of [0, 1]) corners.push(x, y, z)
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array(corners))
	const mesh = document
		.createMesh()
		.addPrimitive(document.createPrimitive().setAttribute('POSITION', position))
	document
		.createScene()
		.addChild(document.createNode().setMesh(mesh).setTranslation([10, 5, -3]))
	return new WebIO().writeBinary(document)
}

async function placedBounds(optimizer: ModelOptimizer) {
	const document = await new WebIO().readBinary(await optimizer.export())
	return getBounds(document.getRoot().listScenes()[0])
}

describe('ModelOptimizer.place', () => {
	it('centers the model on X and Z and stands it on y = 0', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await offsetBoxGlb())

		await optimizer.place()

		const { min, max } = await placedBounds(optimizer)
		expect(min[1]).toBeCloseTo(0)
		expect((min[0] + max[0]) / 2).toBeCloseTo(0)
		expect((min[2] + max[2]) / 2).toBeCloseTo(0)
		// No size given, so the model keeps its own.
		expect(max[1] - min[1]).toBeCloseTo(4)
		expect(optimizer.getAppliedOptimizations()).toContain('placement')
	})

	it('scales uniformly so the longest edge has the given length', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await offsetBoxGlb())

		await optimizer.place({ longestEdgeMeters: 0.5 })

		const { min, max } = await placedBounds(optimizer)
		expect(max[1] - min[1]).toBeCloseTo(0.5)
		expect(max[0] - min[0]).toBeCloseTo(0.25)
		expect(max[2] - min[2]).toBeCloseTo(0.125)
		expect(min[1]).toBeCloseTo(0)
	})

	it('leaves an empty scene alone', async () => {
		const document = new Document()
		document.createScene()
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await new WebIO().writeBinary(document))

		await expect(optimizer.place({ longestEdgeMeters: 1 })).resolves.toBe(
			undefined
		)
	})
})
