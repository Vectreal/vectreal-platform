import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3d'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { createNodePublishCodecs } from '.'
import { loadMeshoptDecoder } from '../meshopt/meshopt-codec'
import { ModelExporter } from '../model-exporter/model-exporter'
import { readGlbExtensionsUsed } from '../model-loader/glb-extensions'

/**
 * The publish export as an agent's CLI runs it: real Draco, real Basis and
 * real sharp, in Node, with nothing mocked. Each is what a browser-only path
 * would silently lose here, so each is asserted on the file it produced.
 */

/** A sphere dense enough that Draco and meshopt both have work to do. */
function sphere(document: Document, segments = 48) {
	const buffer = document.createBuffer()
	const positions: number[] = []
	const uvs: number[] = []
	const indices: number[] = []
	for (let y = 0; y <= segments; y++) {
		for (let x = 0; x <= segments; x++) {
			const u = (x / segments) * Math.PI * 2
			const v = (y / segments) * Math.PI
			positions.push(
				Math.sin(v) * Math.cos(u),
				Math.cos(v),
				Math.sin(v) * Math.sin(u)
			)
			uvs.push(x / segments, y / segments)
		}
	}
	for (let y = 0; y < segments; y++) {
		for (let x = 0; x < segments; x++) {
			const a = y * (segments + 1) + x
			const b = a + segments + 1
			indices.push(a, b, a + 1, b, b + 1, a + 1)
		}
	}
	const accessor = (
		type: 'VEC3' | 'VEC2' | 'SCALAR',
		array: ArrayLike<number>
	) =>
		document
			.createAccessor()
			.setType(type)
			.setArray(
				type === 'SCALAR' ? new Uint32Array(array) : new Float32Array(array)
			)
			.setBuffer(buffer)
	return document
		.createPrimitive()
		.setAttribute('POSITION', accessor('VEC3', positions))
		.setAttribute('TEXCOORD_0', accessor('VEC2', uvs))
		.setIndices(accessor('SCALAR', indices))
}

/** A textured sphere as a GLB: a 256 px PNG of noise as its base colour. */
async function texturedGlb(): Promise<Uint8Array> {
	const size = 256
	const pixels = Buffer.alloc(size * size * 4)
	let seed = 7
	for (let i = 0; i < pixels.length; i++) {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff
		pixels[i] = i % 4 === 3 ? 255 : seed & 0xff
	}
	const png = await sharp(pixels, {
		raw: { width: size, height: size, channels: 4 }
	})
		.png()
		.toBuffer()

	const document = new Document()
	const texture = document
		.createTexture('noise')
		.setImage(new Uint8Array(png))
		.setMimeType('image/png')
	const material = document
		.createMaterial('surface')
		.setBaseColorTexture(texture)
	const primitive = sphere(document).setMaterial(material)
	const mesh = document.createMesh('sphere').addPrimitive(primitive)
	document.createScene().addChild(document.createNode('sphere').setMesh(mesh))
	return new NodeIO().writeBinary(document)
}

/** A Node reader that can open anything the export writes. */
async function nodeReader() {
	const io = new NodeIO()
		.registerExtensions(ALL_EXTENSIONS)
		.registerDependencies({
			'draco3d.decoder': await draco3d.createDecoderModule()
		})
	return io.registerDependencies({
		'meshopt.decoder': await loadMeshoptDecoder()
	})
}

describe('the publish export in Node.js', () => {
	it('measures Draco and encodes textures to KTX2, in a file Node reads back', async () => {
		const { dracoModules, encodeKtx2 } = createNodePublishCodecs()
		const exporter = new ModelExporter({ dracoModules })
		const progress: number[] = []

		const result = await exporter.exportGlbForPublish(await texturedGlb(), {
			draco: { method: 'edgebreaker' },
			ktx2: {
				encode: encodeKtx2,
				onProgress: (done) => progress.push(done)
			}
		})

		// Without the injected modules Draco fails, and the measurement
		// swallows that and quietly picks another codec.
		expect(result.geometrySizes?.draco).toEqual(expect.any(Number))
		expect(result.geometryCodec).not.toBe('none')
		expect(result.textures).toEqual({ encoded: ['noise'], kept: [] })
		expect(progress.at(-1)).toBe(1)

		const extensions = readGlbExtensionsUsed(result.data)
		expect(extensions).toContain('KHR_texture_basisu')
		expect(extensions).toContain(
			result.geometryCodec === 'draco'
				? 'KHR_draco_mesh_compression'
				: 'EXT_meshopt_compression'
		)
		const read = await (await nodeReader()).readBinary(result.data)
		expect(read.getRoot().listMeshes()).toHaveLength(1)
		expect(read.getRoot().listTextures()[0].getMimeType()).toBe('image/ktx2')
	}, 60_000)

	it('reads a Draco-compressed GLB, which needs the decoder it was given', async () => {
		const { dracoModules } = createNodePublishCodecs()
		const plain = await (await nodeReader()).readBinary(await texturedGlb())
		const compressed = await new ModelExporter({
			dracoModules
		}).exportDocumentGLBDraco(plain)
		expect(readGlbExtensionsUsed(compressed.data)).toContain(
			'KHR_draco_mesh_compression'
		)

		const republished = await new ModelExporter({
			dracoModules
		}).exportGlbForPublish(compressed.data)
		expect(
			(await (await nodeReader()).readBinary(republished.data))
				.getRoot()
				.listMeshes()
		).toHaveLength(1)

		// Without them, the read fails rather than returning empty geometry.
		await expect(
			new ModelExporter().exportGlbForPublish(compressed.data)
		).rejects.toThrow()
	}, 60_000)
})
