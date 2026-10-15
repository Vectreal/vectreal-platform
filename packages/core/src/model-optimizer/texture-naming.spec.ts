/**
 * Every way a document reaches the optimizer gives its textures their
 * canonical names: a material slot where the texture has one, its position
 * where it does not.
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Document, JSONDocument, Texture, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'
import {
	resolveTextureCanonicalFileName,
	syncTextureIdentities
} from './texture-naming'
import { getTexturePayload, replaceTexturePayload } from './texture-payload'

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

/*
  The rules themselves, called directly. Every test above goes through a load
  or a payload read, both of which resolve a name again, so a rule could
  change under them unseen.
*/
describe('texture naming rules', () => {
	const textureIn = (
		document: Document,
		{
			mimeType = 'image/png',
			uri = '',
			name = '',
			material,
			// Bytes no format matches, so the stored type is what is tested.
			image = new Uint8Array([1])
		}: {
			mimeType?: string
			uri?: string
			name?: string
			material?: string
			image?: Uint8Array
		} = {}
	) => {
		const texture = document
			.createTexture(name)
			.setImage(image)
			.setMimeType(mimeType)
		if (uri) texture.setURI(uri).setMimeType(mimeType)
		if (material) {
			document.createMaterial(material).setBaseColorTexture(texture)
		}
		return texture
	}

	const identity = (texture: Texture) => ({
		uri: texture.getURI(),
		name: texture.getName(),
		mimeType: texture.getMimeType()
	})

	it.each([
		['image/ktx2', 'Wood_baseColor.ktx2'],
		['image/avif', 'Wood_baseColor.avif']
	])(
		'keeps an embedded %s texture its type and names it %s',
		(mimeType, fileName) => {
			const document = new Document()
			const texture = textureIn(document, { mimeType, material: 'Wood' })

			syncTextureIdentities(document)

			expect(identity(texture)).toEqual({
				uri: fileName,
				name: fileName,
				mimeType
			})
		}
	)

	it('names bytes by the type they were given, not the file name', () => {
		const document = new Document()
		textureIn(document)

		replaceTexturePayload(
			document,
			0,
			new Uint8Array([1]),
			'image/webp',
			'oak.png'
		)

		expect(identity(document.getRoot().listTextures()[0])).toEqual({
			uri: 'oak.webp',
			name: 'oak.webp',
			mimeType: 'image/webp'
		})
	})

	it('stores the name it reports after a preferred file name', () => {
		const document = new Document()
		textureIn(document, {
			uri: 'oak.jpg',
			name: 'oak.jpg',
			mimeType: 'image/jpeg'
		})

		replaceTexturePayload(
			document,
			0,
			new Uint8Array([1]),
			'image/jpeg',
			'oak.jpeg'
		)

		const stored = document.getRoot().listTextures()[0]
		const reported = getTexturePayload(document, 0).fileName
		expect([stored.getURI(), stored.getName()]).toEqual([reported, reported])
		expect(reported).toBe('oak.jpg')
	})

	// A type read off a URI keeps that URI's spelling; glTF wants it canonical.
	it.each([
		// No type stored: the one the getter reads off the URI is normalized.
		['textures/Wood.JPG', '', 'Wood.jpg', 'image/jpeg'],
		['textures/Wood.PNG', 'image/PNG', 'Wood.png', 'image/png'],
		['textures/Wood.WEBP', 'image/WEBP', 'Wood.webp', 'image/webp'],
		['wood.png?v=2', 'image/png?v=2', 'wood.png', 'image/png'],
		['wood.png#x', 'image/png#x', 'wood.png', 'image/png'],
		['wood.png', 'image/png ; q=1', 'wood.png', 'image/png'],
		['textures/Wood.JPG', 'image/JPG', 'Wood.jpg', 'image/jpeg'],
		['wood.jpg?v=2', 'image/png?v=2', 'wood.png', 'image/png']
	])('names %s %s as %s %s', (uri, mimeType, fileName, normalized) => {
		const document = new Document()
		const texture = textureIn(document, { uri, mimeType })

		syncTextureIdentities(document)

		expect(identity(texture)).toEqual({
			uri: fileName,
			name: fileName,
			mimeType: normalized
		})
	})

	// With no type stored, the old URI's extension is only a guess.
	it('takes the type from the new name when none is stored', () => {
		const document = new Document()
		textureIn(document, { uri: 'oak.jpg' })

		replaceTexturePayload(document, 0, new Uint8Array([1]), '', 'oak.png')

		const texture = document.getRoot().listTextures()[0]
		expect(identity(texture)).toEqual({
			uri: 'oak.png',
			name: 'oak.png',
			mimeType: 'image/png'
		})
	})

	// Some exporters store `application/octet-stream` for an embedded image.
	it('takes the type from the name when the stored one is not an image type', () => {
		const document = new Document()
		const texture = textureIn(document, {
			uri: 'oak.png',
			mimeType: 'application/octet-stream'
		})

		syncTextureIdentities(document)

		expect(identity(texture)).toEqual({
			uri: 'oak.png',
			name: 'oak.png',
			mimeType: 'image/png'
		})
	})

	it.each([
		['logo.svg', 'image/svg+xml', 'logo.svg'],
		['', 'image/gif', 'Wood_baseColor']
	])(
		'keeps an image type it has no extension for (%s, %s)',
		(uri, mimeType, fileName) => {
			const document = new Document()
			const texture = textureIn(document, { uri, mimeType, material: 'Wood' })

			syncTextureIdentities(document)

			expect(identity(texture)).toEqual({
				uri: fileName,
				name: fileName,
				mimeType
			})
		}
	)

	it('reads the type off the bytes when it is given none and no name', () => {
		const document = new Document()
		textureIn(document, { material: 'Wood' })

		replaceTexturePayload(
			document,
			0,
			ONE_PIXEL_PNG.slice(),
			'application/octet-stream'
		)

		expect(identity(document.getRoot().listTextures()[0])).toEqual({
			uri: 'Wood_baseColor.png',
			name: 'Wood_baseColor.png',
			mimeType: 'image/png'
		})
	})

	it.each([
		['application/octet-stream'],
		// What an extensionless name made gltf-transform store before.
		['image/Wood_baseColor']
	])('names a PNG stored as %s by its bytes', (mimeType) => {
		const document = new Document()
		const texture = textureIn(document, {
			mimeType,
			material: 'Wood',
			image: ONE_PIXEL_PNG.slice()
		})

		syncTextureIdentities(document)

		expect(identity(texture)).toEqual({
			uri: 'Wood_baseColor.png',
			name: 'Wood_baseColor.png',
			mimeType: 'image/png'
		})
	})

	it('names a texture whose bytes are not loaded by its stored type', () => {
		const document = new Document()
		const texture = document
			.createTexture()
			.setURI('wood.jpg')
			.setMimeType('image/png')

		syncTextureIdentities(document)

		expect(identity(texture)).toEqual({
			uri: 'wood.png',
			name: 'wood.png',
			mimeType: 'image/png'
		})
	})

	it('stores exactly the name it reports, whitespace and all', () => {
		const document = new Document()
		const texture = textureIn(document, { uri: ' oak.png', name: ' oak.png ' })

		syncTextureIdentities(document)

		expect([texture.getURI(), texture.getName()]).toEqual([
			'oak.png',
			'oak.png'
		])
	})

	it('names a texture with a generic URI after its material slot', () => {
		const document = new Document()
		const texture = textureIn(document, {
			uri: 'textures/texture_0.png',
			material: 'Wood'
		})

		expect(resolveTextureCanonicalFileName(document, texture, 0)).toBe(
			'Wood_baseColor.png'
		)
	})

	it('prefers a stable URI over a stable name', () => {
		const document = new Document()
		const texture = textureIn(document, { name: 'Oak', uri: 'oak_diffuse.png' })

		expect(resolveTextureCanonicalFileName(document, texture, 0)).toBe(
			'oak_diffuse.png'
		)
	})

	it('names unslotted textures by their position after a texture pass', async () => {
		const document = new Document()
		document.createBuffer()
		textureIn(document, { image: ONE_PIXEL_PNG.slice() })
		textureIn(document, { image: ONE_PIXEL_PNG.slice() })
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await io.writeBinary(document))
		const encoder = () => {
			const instance = {
				toFormat: () => instance,
				resize: () => instance,
				toBuffer: async () => new Uint8Array([1, 2, 3])
			}
			return instance
		}

		await optimizer.compressTextures({ encoder, targetFormat: 'webp' })

		expect(
			optimizer.document
				.getRoot()
				.listTextures()
				.map((texture) => texture.getName())
		).toEqual(['texture-0.webp', 'texture-1.webp'])
	})
})
