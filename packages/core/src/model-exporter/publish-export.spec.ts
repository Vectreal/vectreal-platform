import { Document, WebIO } from '@gltf-transform/core'
import {
	ALL_EXTENSIONS,
	KHRMeshPrimitiveRestart
} from '@gltf-transform/extensions'
import { Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelExporter } from './model-exporter'
import { readGlbExtensionsUsed } from '../model-loader/glb-extensions'
import { ModelLoader } from '../model-loader/model-loader'
import { ModelOptimizer } from '../model-optimizer/model-optimizer'

import type { Mesh } from 'three'

/**
 * A sphere-ish grid, large and regular enough that meshopt shrinks it. A
 * single triangle compresses to nothing either way.
 */
function gridDocument(segments = 48): Document {
	const document = new Document()
	const buffer = document.createBuffer()
	const positions: number[] = []
	const indices: number[] = []
	for (let y = 0; y <= segments; y++) {
		for (let x = 0; x <= segments; x++) {
			const u = (x / segments) * Math.PI * 2
			const v = (y / segments) * Math.PI
			positions.push(
				Math.sin(v) * Math.cos(u) * 3,
				Math.cos(v) * 3,
				Math.sin(v) * Math.sin(u) * 3
			)
		}
	}
	for (let y = 0; y < segments; y++) {
		for (let x = 0; x < segments; x++) {
			const a = y * (segments + 1) + x
			const b = a + segments + 1
			indices.push(a, b, a + 1, b, b + 1, a + 1)
		}
	}
	const primitive = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			document
				.createAccessor()
				.setType('VEC3')
				.setArray(new Float32Array(positions))
				.setBuffer(buffer)
		)
		.setIndices(
			document
				.createAccessor()
				.setType('SCALAR')
				.setArray(new Uint32Array(indices))
				.setBuffer(buffer)
		)
	const mesh = document.createMesh('grid').addPrimitive(primitive)
	document.createScene().addChild(document.createNode('grid').setMesh(mesh))
	return document
}

const meshesOf = (scene: { traverse: (fn: (o: unknown) => void) => void }) => {
	const meshes: Mesh[] = []
	scene.traverse((object) => {
		if ((object as Mesh).isMesh) meshes.push(object as Mesh)
	})
	return meshes
}

type CodecSpy = { applyGeometryCodec: (...args: unknown[]) => unknown }

describe('ModelExporter.exportDocumentGLBForPublish', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('ships meshopt geometry that parses back within quantization tolerance', async () => {
		const source = gridDocument()
		const sourcePositions = source
			.getRoot()
			.listAccessors()
			.find((accessor) => accessor.getType() === 'VEC3')
			?.getArray() as Float32Array

		// No Draco encoder in Node, which is the "encoder unavailable" case.
		const result = await new ModelExporter().exportDocumentGLBForPublish(
			source,
			{ draco: {} }
		)

		expect(result.geometryCodec).toBe('meshopt')
		expect(result.geometrySizes?.draco).toBeUndefined()
		expect(readGlbExtensionsUsed(result.data)).toContain(
			'EXT_meshopt_compression'
		)

		const parsed = await new ModelLoader().parseGLBToThreeJS(result.data)
		const [mesh] = meshesOf(parsed.scene)
		mesh.updateWorldMatrix(true, false)
		// Read through the node's dequantizing transform rather than baking it
		// in: the attribute is normalized int16, which clamps anything outside
		// [-1, 1] written back to it.
		const positions = mesh.geometry.getAttribute('position')
		expect(positions.count).toBe(sourcePositions.length / 3)

		// 14-bit positions over a 6-unit extent: about 4e-4 per step.
		for (let i = 0; i < positions.count; i++) {
			const vertex = new Vector3()
				.fromBufferAttribute(positions, i)
				.applyMatrix4(mesh.matrixWorld)
				.toArray()
			const nearest = Math.min(
				...Array.from({ length: sourcePositions.length / 3 }, (_, j) =>
					Math.hypot(
						vertex[0] - sourcePositions[j * 3],
						vertex[1] - sourcePositions[j * 3 + 1],
						vertex[2] - sourcePositions[j * 3 + 2]
					)
				)
			)
			expect(nearest).toBeLessThan(1e-3)
		}
	})

	it('reads back into an editable document through the loader and the optimizer', async () => {
		const { data } = await new ModelExporter().exportDocumentGLBForPublish(
			gridDocument(),
			{ draco: {} }
		)

		const loaded = await new ModelLoader().loadFromBuffer(data, 'scene.glb')
		expect(loaded.data.getRoot().listMeshes()).toHaveLength(1)
		await expect(
			new WebIO().registerExtensions(ALL_EXTENSIONS).writeBinary(loaded.data)
		).resolves.toBeInstanceOf(Uint8Array)

		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(data)
		await expect(optimizer.export()).resolves.toBeInstanceOf(Uint8Array)
	})

	it('leaves geometry alone when compression is off', async () => {
		const result = await new ModelExporter().exportDocumentGLBForPublish(
			gridDocument()
		)

		expect(result.geometryCodec).toBe('none')
		expect(result.geometrySizes).toBeUndefined()
		expect(readGlbExtensionsUsed(result.data)).toEqual([])
	})

	it('rewrites textures once, on a clone, before encoding geometry', async () => {
		const source = gridDocument()
		const textures = vi.fn(async (document: Document) => {
			document.getRoot().listNodes()[0].setName('rewritten')
		})

		const result = await new ModelExporter().exportDocumentGLBForPublish(
			source,
			{ draco: {}, textures }
		)

		expect(textures).toHaveBeenCalledOnce()
		expect(result.textureBytes).toBe(0)
		expect(source.getRoot().listNodes()[0].getName()).toBe('grid')
		expect(new TextDecoder().decode(result.data)).toContain('rewritten')
	})

	it('ships plain geometry when meshopt refuses it, rather than failing', async () => {
		const source = gridDocument()
		source.createExtension(KHRMeshPrimitiveRestart)

		const result = await new ModelExporter().exportDocumentGLBForPublish(
			source,
			{ draco: {} }
		)

		expect(result.geometryCodec).toBe('none')
		expect(result.geometrySizes?.meshopt).toBeUndefined()
	})

	it('measures geometry without the textures every codec would share', async () => {
		const source = gridDocument()
		const texture = source
			.createTexture('color')
			.setImage(new Uint8Array(4096).map((_, i) => (i * 7919) % 251))
			.setMimeType('image/png')
		source.createMaterial().setBaseColorTexture(texture)
		source
			.getRoot()
			.listMeshes()[0]
			.listPrimitives()[0]
			.setMaterial(source.getRoot().listMaterials()[0])
		const written: number[] = []
		const writeBinary = WebIO.prototype.writeBinary
		vi.spyOn(WebIO.prototype, 'writeBinary').mockImplementation(function (
			this: WebIO,
			document: Document
		) {
			written.push(document.getRoot().listTextures().length)
			return writeBinary.call(this, document)
		})

		const result = await new ModelExporter().exportDocumentGLBForPublish(
			source,
			{ draco: {} }
		)

		expect(written.at(-1)).toBe(1)
		expect(result.textureBytes).toBe(4096)
		expect(written.slice(0, -1)).toEqual([0, 0])
	})

	it('measures Draco only when the optimizer found it worth applying', async () => {
		const tried = async (dracoWorthApplying: boolean) => {
			const spy = vi.spyOn(
				ModelExporter.prototype as unknown as CodecSpy,
				'applyGeometryCodec'
			)
			await new ModelExporter().exportDocumentGLBForPublish(gridDocument(), {
				draco: {},
				dracoWorthApplying
			})
			const codecs = spy.mock.calls.map(([, codec]) => codec)
			spy.mockRestore()
			return codecs
		}

		expect(await tried(true)).toContain('draco')
		expect(await tried(false)).not.toContain('draco')
	})

	it('reads back from glTF JSON through the loader and the optimizer', async () => {
		const { data } = await new ModelExporter().exportDocumentGLBForPublish(
			gridDocument(),
			{ draco: {} }
		)
		const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer')
		await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
		const io = new WebIO()
			.registerExtensions(ALL_EXTENSIONS)
			.registerDependencies({
				'meshopt.decoder': MeshoptDecoder,
				'meshopt.encoder': MeshoptEncoder
			})
		const gltf = await io.writeJSON(await io.readBinary(data))
		expect(gltf.json.extensionsUsed).toContain('EXT_meshopt_compression')

		const loaded = await new ModelLoader().loadGLTFWithAssets(
			new TextEncoder().encode(JSON.stringify(gltf.json)),
			new Map(Object.entries(gltf.resources)),
			'scene.gltf'
		)
		await expect(
			new WebIO().registerExtensions(ALL_EXTENSIONS).writeBinary(loaded.data)
		).resolves.toBeInstanceOf(Uint8Array)

		const optimizer = new ModelOptimizer()
		await optimizer.loadFromJSON(gltf)
		await expect(optimizer.export()).resolves.toBeInstanceOf(Uint8Array)
	})
})
