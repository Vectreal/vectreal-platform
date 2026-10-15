import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'

import { ModelLoader } from './model-loader'
import { ModelOptimizer } from '../model-optimizer/model-optimizer'

/**
 * Where WebAssembly cannot compile (a CSP without `wasm-unsafe-eval`), the
 * meshopt decoder cannot load. Models that do not use meshopt must still read.
 */
vi.mock('../meshopt/meshopt-codec', async (importOriginal) => ({
	...(await importOriginal<typeof import('../meshopt/meshopt-codec')>()),
	registerMeshoptDecoder: async () => {
		throw new Error('WebAssembly.compile(): refused by CSP')
	}
}))

async function triangleGlb(): Promise<Uint8Array> {
	const document = new Document()
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
		.setBuffer(document.createBuffer())
	const mesh = document
		.createMesh()
		.addPrimitive(document.createPrimitive().setAttribute('POSITION', position))
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return new WebIO().writeBinary(document)
}

describe('a page that cannot load the meshopt decoder', () => {
	it('still reads a model without meshopt into the loader and the optimizer', async () => {
		const bytes = await triangleGlb()

		const loaded = await new ModelLoader().loadFromBuffer(bytes, 'plain.glb')
		expect(loaded.data.getRoot().listMeshes()).toHaveLength(1)

		await expect(
			new ModelOptimizer().loadFromBuffer(bytes)
		).resolves.toBeUndefined()
	})
})
