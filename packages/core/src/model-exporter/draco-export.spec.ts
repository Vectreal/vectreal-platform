/**
 * Every Draco export path registers the encoder on the exporter's WebIO before
 * it writes, since `draco()` only marks primitives and the write encodes them.
 *
 * Draco cannot load outside a browser, so the module loader reports a browser
 * and hands back a stand-in module; the specs stop at the write, which is all
 * they ask about.
 */
import { Document, WebIO } from '@gltf-transform/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelExporter } from './model-exporter'

const encoderModule = { stands: 'in for draco3d.encoder' }

vi.mock('../draco/load-draco-module', async (importOriginal) => ({
	...(await importOriginal<typeof import('../draco/load-draco-module')>()),
	canLoadDracoInBrowser: () => true,
	loadDracoModule: async () => encoderModule
}))

function triangleDocument(): Document {
	const document = new Document()
	const buffer = document.createBuffer()
	const positions = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
		.setBuffer(buffer)
	const mesh = document
		.createMesh()
		.addPrimitive(
			document.createPrimitive().setAttribute('POSITION', positions)
		)
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return document
}

/** Whether the encoder was registered on the WebIO that writes, when it writes. */
function watchWrite(method: 'writeBinary' | 'writeJSON') {
	const registered = new Set<WebIO>()
	const seen: boolean[] = []
	vi.spyOn(WebIO.prototype, 'registerDependencies').mockImplementation(
		function (this: WebIO, dependencies) {
			if (dependencies['draco3d.encoder'] === encoderModule) {
				registered.add(this)
			}
			return this
		}
	)
	vi.spyOn(WebIO.prototype, method).mockImplementation(function (this: WebIO) {
		seen.push(registered.has(this))
		throw new Error('stopped at the write')
	})
	return seen
}

describe('ModelExporter Draco exports', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('registers the encoder before writing a Draco GLB', async () => {
		const seen = watchWrite('writeBinary')

		await expect(
			new ModelExporter().exportDocumentGLBDraco(triangleDocument())
		).rejects.toThrow('stopped at the write')

		expect(seen).toEqual([true])
	})

	it('registers the encoder before writing a Draco glTF', async () => {
		const seen = watchWrite('writeJSON')

		await expect(
			new ModelExporter().exportDocumentGLTF(triangleDocument(), { draco: {} })
		).rejects.toThrow('stopped at the write')

		expect(seen).toEqual([true])
	})
})
