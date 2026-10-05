import { Document, WebIO } from '@gltf-transform/core'
import { KHRTextureBasisu } from '@gltf-transform/extensions'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ModelLoader } from './model-loader'

const ktx2 = vi.hoisted(() => ({
	getThreeKtx2Loader: vi.fn(async () => ({ isKTX2Loader: true }))
}))

vi.mock('./ktx2-three-loader', () => ({
	getThreeKtx2Loader: ktx2.getThreeKtx2Loader,
	prepareThreeKtx2Transcoder: async () => undefined
}))

const KTX2 = 'KHR_texture_basisu'

function triangleDocument(withKtx2: boolean): Document {
	const document = new Document()
	if (withKtx2) document.createExtension(KHRTextureBasisu)
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
		.setBuffer(document.createBuffer())
	const mesh = document
		.createMesh()
		.addPrimitive(document.createPrimitive().setAttribute('POSITION', position))
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return document
}

const modelResult = { type: 'glb', size: 0, name: 'scene.glb', loadTime: 0 }

describe('the KTX2 loader attached to three.js parses', () => {
	beforeEach(() => {
		ktx2.getThreeKtx2Loader.mockClear()
		// three's FileLoader reports progress with a browser-only event.
		vi.stubGlobal('ProgressEvent', class extends Event {})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it('is created for a GLB that declares KHR_texture_basisu, and only then', async () => {
		const loader = new ModelLoader()
		const io = new WebIO().registerExtensions([KHRTextureBasisu])

		await loader.parseGLBToThreeJS(
			await io.writeBinary(triangleDocument(false))
		)
		expect(ktx2.getThreeKtx2Loader).not.toHaveBeenCalled()

		const setKTX2Loader = vi.spyOn(GLTFLoader.prototype, 'setKTX2Loader')
		await loader.parseGLBToThreeJS(await io.writeBinary(triangleDocument(true)))
		expect(ktx2.getThreeKtx2Loader).toHaveBeenCalledWith('/basis/')
		expect(setKTX2Loader).toHaveBeenCalledWith(
			await ktx2.getThreeKtx2Loader.mock.results[0].value
		)
	})

	it('is created for a document that declares it', async () => {
		const loader = new ModelLoader()

		await loader.documentToThreeJS(
			triangleDocument(false),
			modelResult as never
		)
		expect(ktx2.getThreeKtx2Loader).not.toHaveBeenCalled()

		await loader.documentToThreeJS(triangleDocument(true), modelResult as never)
		expect(ktx2.getThreeKtx2Loader).toHaveBeenCalledOnce()
	})

	it('is created for glTF JSON that declares it, from the configured path', async () => {
		const loader = new ModelLoader({ ktx2TranscoderPath: '/cdn/basis/' })
		const io = new WebIO().registerExtensions([KHRTextureBasisu])
		const { json, resources } = await io.writeJSON(triangleDocument(true))
		const assets = new Map(Object.entries(resources))

		await loader.parseGLTFJsonToThreeJS({ ...json, extensionsUsed: [] }, assets)
		expect(ktx2.getThreeKtx2Loader).not.toHaveBeenCalled()

		await loader.parseGLTFJsonToThreeJS(
			{ ...json, extensionsUsed: [KTX2] },
			assets
		)
		expect(ktx2.getThreeKtx2Loader).toHaveBeenCalledWith('/cdn/basis/')
	})
})
