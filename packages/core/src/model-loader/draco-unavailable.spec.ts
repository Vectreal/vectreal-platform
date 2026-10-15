import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'

import { ModelLoader } from './model-loader'

/**
 * A page that hosts no Draco decoder, as a third-party page showing
 * `<VectrealViewer src>` usually does. Models that do not use Draco must not
 * fetch it, and one that does fails naming the path it tried.
 */
const draco = vi.hoisted(() => ({ requested: [] as string[] }))

vi.mock('../draco/load-draco-module', async (importOriginal) => ({
	...(await importOriginal<typeof import('../draco/load-draco-module')>()),
	canLoadDracoInBrowser: () => true,
	loadDracoModule: async (kind: string, path: string) => {
		draco.requested.push(kind)
		throw new Error(`Failed to load Draco ${kind} script from ${path}`)
	}
}))

async function triangle(extensionsUsed: string[] = []) {
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
	const { json, resources } = await new WebIO().writeJSON(document)
	json.extensionsUsed = extensionsUsed
	return { json, resources }
}

async function glb(): Promise<Uint8Array> {
	const { json, resources } = await triangle()
	const io = new WebIO()
	return io.writeBinary(await io.readJSON({ json, resources }))
}

async function gltfWithAssets(extensionsUsed: string[] = []) {
	const { json, resources } = await triangle(extensionsUsed)
	return {
		gltf: new TextEncoder().encode(JSON.stringify(json)),
		assets: new Map(Object.entries(resources))
	}
}

describe('a page that serves no Draco decoder', () => {
	it('reads a GLB that does not use Draco without fetching the decoder', async () => {
		draco.requested = []

		const loaded = await new ModelLoader().loadFromBuffer(
			await glb(),
			'plain.glb'
		)

		expect(loaded.data.getRoot().listMeshes()).toHaveLength(1)
		expect(draco.requested).toEqual([])
	})

	it('reads a glTF that does not use Draco without fetching the decoder', async () => {
		draco.requested = []
		const { gltf, assets } = await gltfWithAssets()

		const loaded = await new ModelLoader().loadGLTFWithAssets(
			gltf,
			assets,
			'plain.gltf'
		)

		expect(loaded.data.getRoot().listMeshes()).toHaveLength(1)
		expect(draco.requested).toEqual([])
	})

	it('fails a model that declares Draco, naming the path it tried', async () => {
		draco.requested = []
		// Declared but unused: what fails is fetching the decoder, before any
		// primitive is read.
		const { gltf, assets } = await gltfWithAssets([
			'KHR_draco_mesh_compression'
		])

		await expect(
			new ModelLoader({ dracoDecoderPath: '/nowhere/' }).loadGLTFWithAssets(
				gltf,
				assets,
				'draco.gltf'
			)
		).rejects.toThrow('/nowhere/')
		expect(draco.requested).toEqual(['decoder'])
	})
})
