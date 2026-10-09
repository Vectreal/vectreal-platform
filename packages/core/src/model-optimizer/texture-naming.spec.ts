/**
 * Every way a document reaches the optimizer gives its textures their
 * canonical names: a material slot where the texture has one, its position
 * where it does not.
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Document, JSONDocument, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'

const io = new WebIO()

const ONE_PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
)

/** Wood's base colour, then a texture on no material; neither named. */
async function unnamedGlb(): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const texture = () =>
		document
			.createTexture()
			.setImage(ONE_PIXEL_PNG.slice())
			.setMimeType('image/png')
	const material = document
		.createMaterial('Wood')
		.setBaseColorTexture(texture())
	texture()
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
	const mesh = document
		.createMesh()
		.addPrimitive(
			document
				.createPrimitive()
				.setAttribute('POSITION', position)
				.setMaterial(material)
		)
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return io.writeBinary(document)
}

/** As a .gltf and its files, with the generic image names many exporters write. */
async function asGltf(glb: Uint8Array): Promise<JSONDocument> {
	const { json, resources } = await io.writeJSON(await io.readBinary(glb))
	const files = { ...resources }
	json.images?.forEach((image, i) => {
		const uri = `image${i}.png`
		files[uri] = resources[image.uri!]
		delete files[image.uri!]
		image.uri = uri
	})
	return { json, resources: files }
}

const unname = (document: Document) => {
	for (const texture of document.getRoot().listTextures()) {
		texture.setName('').setURI('')
	}
}

const ENTRIES: Array<
	[string, (optimizer: ModelOptimizer, glb: Uint8Array) => Promise<void>]
> = [
	['loadFromBuffer', (optimizer, glb) => optimizer.loadFromBuffer(glb)],
	[
		'loadFromFile',
		async (optimizer, glb) => {
			const path = join(await mkdtemp(join(tmpdir(), 'naming-')), 'model.glb')
			await writeFile(path, glb)
			await optimizer.loadFromFile(path)
		}
	],
	[
		'loadFromJSON',
		async (optimizer, glb) => optimizer.loadFromJSON(await asGltf(glb))
	],
	[
		'loadFromGLTFWithAssets',
		async (optimizer, glb) => {
			const { json, resources } = await asGltf(glb)
			await optimizer.loadFromGLTFWithAssets(
				new TextEncoder().encode(JSON.stringify(json)),
				new Map(Object.entries(resources))
			)
		}
	],
	[
		'restoreSource',
		async (optimizer, glb) => {
			await optimizer.loadFromBuffer(glb)
			unname(optimizer.document)
			await optimizer.restoreSource()
		}
	],
	[
		'replaceDocument',
		async (optimizer, glb) => {
			await optimizer.loadFromBuffer(glb)
			unname(optimizer.document)
			await optimizer.replaceDocument(glb)
		}
	],
	[
		'normalizeAllTextureURIs',
		async (optimizer, glb) => {
			await optimizer.loadFromBuffer(glb)
			unname(optimizer.document)
			optimizer.normalizeAllTextureURIs()
		}
	]
]

describe('ModelOptimizer texture naming', () => {
	it.each(ENTRIES)('%s names every texture', async (_, enter) => {
		const optimizer = new ModelOptimizer()

		await enter(optimizer, await unnamedGlb())

		expect(
			optimizer.document
				.getRoot()
				.listTextures()
				.map((texture) => [texture.getName(), texture.getURI()])
		).toEqual([
			['Wood_baseColor.png', 'Wood_baseColor.png'],
			['texture-1.png', 'texture-1.png']
		])
	})
})
