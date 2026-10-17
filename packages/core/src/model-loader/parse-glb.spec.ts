import { Document, WebIO } from '@gltf-transform/core'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { ModelLoader } from './model-loader'

import type { Material, Mesh } from 'three'

/** Stands in for three's decoder, which needs a browser worker. */
const dracoDecoder = vi.hoisted(() => ({
	preload: vi.fn(),
	decodeDracoFile: vi.fn()
}))

vi.mock('./draco-three-loader', () => ({
	getThreeDracoLoader: async () => dracoDecoder,
	prepareThreeDracoDecoder: async () => undefined
}))

/** A GLB whose one primitive is Draco-compressed, as a publish writes it. */
function dracoTriangleGlb(): Uint8Array {
	const draco = 'KHR_draco_mesh_compression'
	const json = JSON.stringify({
		asset: { version: '2.0' },
		extensionsUsed: [draco],
		extensionsRequired: [draco],
		buffers: [{ byteLength: 4 }],
		bufferViews: [{ buffer: 0, byteLength: 4 }],
		accessors: [{ componentType: 5126, count: 3, type: 'VEC3' }],
		meshes: [
			{
				primitives: [
					{
						attributes: { POSITION: 0 },
						extensions: {
							[draco]: { bufferView: 0, attributes: { POSITION: 0 } }
						}
					}
				]
			}
		],
		nodes: [{ mesh: 0 }],
		scenes: [{ nodes: [0] }],
		scene: 0
	})
	const jsonBytes = new TextEncoder().encode(
		json.padEnd(Math.ceil(json.length / 4) * 4, ' ')
	)
	const binBytes = new Uint8Array(4)
	const glb = new Uint8Array(12 + 8 + jsonBytes.length + 8 + binBytes.length)
	const view = new DataView(glb.buffer)
	view.setUint32(0, 0x46546c67, true)
	view.setUint32(4, 2, true)
	view.setUint32(8, glb.length, true)
	view.setUint32(12, jsonBytes.length, true)
	view.setUint32(16, 0x4e4f534a, true)
	glb.set(jsonBytes, 20)
	const binStart = 20 + jsonBytes.length
	view.setUint32(binStart, binBytes.length, true)
	view.setUint32(binStart + 4, 0x004e4942, true)
	return glb
}

/** A one-triangle GLB, written the way the publisher writes one. */
async function triangleGlb(): Promise<Uint8Array> {
	const document = new Document()
	const buffer = document.createBuffer()
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
		.setBuffer(buffer)
	const primitive = document
		.createPrimitive()
		.setAttribute('POSITION', position)
	const mesh = document.createMesh('triangle').addPrimitive(primitive)
	const node = document.createNode('triangle').setMesh(mesh)
	document.createScene().addChild(node)
	return new WebIO().writeBinary(document)
}

/**
 * A GLB of triangles that each carry a `COLOR_0` and share one glass material,
 * alpha 0.25 and blended, the shape a Sketchfab export takes. Each entry is one
 * primitive's vertex colors: three components, or four with alpha last.
 */
async function coloredGlassGlb(
	primitives: ReadonlyArray<{ size: 3 | 4; color: readonly number[] }>
): Promise<Uint8Array> {
	const document = new Document()
	const buffer = document.createBuffer()
	const glass = document
		.createMaterial('glass')
		.setBaseColorFactor([0, 0, 0, 0.25])
		.setAlphaMode('BLEND')
	const mesh = document.createMesh('glass')

	for (const { size, color } of primitives) {
		const position = document
			.createAccessor()
			.setType('VEC3')
			.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
			.setBuffer(buffer)
		const colors = document
			.createAccessor()
			.setType(size === 4 ? 'VEC4' : 'VEC3')
			.setArray(new Float32Array([...color, ...color, ...color]))
			.setBuffer(buffer)
		mesh.addPrimitive(
			document
				.createPrimitive()
				.setAttribute('POSITION', position)
				.setAttribute('COLOR_0', colors)
				.setMaterial(glass)
		)
	}

	document.createScene().addChild(document.createNode('glass').setMesh(mesh))
	return new WebIO().writeBinary(document)
}

const meshesOf = (scene: { traverse: (fn: (o: unknown) => void) => void }) => {
	const meshes: Mesh[] = []
	scene.traverse((object) => {
		if ((object as Mesh).isMesh) meshes.push(object as Mesh)
	})
	return meshes
}

describe('ModelLoader.parseGLBToThreeJS', () => {
	it('parses a published GLB into its scene', async () => {
		const bytes = await triangleGlb()
		const result = await new ModelLoader().parseGLBToThreeJS(bytes)

		const meshes = meshesOf(result.scene)
		expect(meshes).toHaveLength(1)
		expect(meshes[0].geometry.getAttribute('position').count).toBe(3)
		expect(result.size).toBe(bytes.byteLength)
	})

	it('reads only its own bytes from a view into a larger buffer', async () => {
		const bytes = await triangleGlb()
		const padded = new Uint8Array(bytes.byteLength + 16)
		padded.set(bytes, 8)
		const view = padded.subarray(8, 8 + bytes.byteLength)

		const result = await new ModelLoader().parseGLBToThreeJS(view)
		expect(meshesOf(result.scene)).toHaveLength(1)
	})

	it('decodes Draco-compressed primitives through the shared decoder', async () => {
		dracoDecoder.decodeDracoFile.mockImplementation(
			(_buffer: ArrayBuffer, onDecoded: (geometry: BufferGeometry) => void) => {
				const geometry = new BufferGeometry()
				geometry.setAttribute(
					'position',
					new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
				)
				onDecoded(geometry)
			}
		)

		const result = await new ModelLoader().parseGLBToThreeJS(dracoTriangleGlb())

		expect(dracoDecoder.decodeDracoFile).toHaveBeenCalledOnce()
		const meshes = meshesOf(result.scene)
		expect(meshes).toHaveLength(1)
		expect(meshes[0].geometry.getAttribute('position').count).toBe(3)
	})
})

/*
  Sketchfab's GLB export writes a `COLOR_0` whose alpha is near zero on every
  vertex. glTF multiplies it in, so its glass vanished and textured trim went
  dark. Driven through the parse a published scene takes, so these fail if the
  loader stops registering the rule, not only if the rule is wrong.
*/
describe('a COLOR_0 that carries no color is not applied', () => {
	const vertexColored = (mesh: Mesh) =>
		(mesh.material as Material & { vertexColors: boolean }).vertexColors

	it('turns vertex colors off where every vertex alpha is near zero', async () => {
		const result = await new ModelLoader().parseGLBToThreeJS(
			await coloredGlassGlb([{ size: 4, color: [0.3, 0.3, 0.3, 16 / 255] }])
		)

		const [mesh] = meshesOf(result.scene)
		expect(vertexColored(mesh)).toBe(false)
		expect((mesh.material as Material).opacity).toBeCloseTo(0.25)
		expect(
			mesh.geometry.getAttribute('color'),
			'the attribute itself is left for an export to write back'
		).toBeDefined()
	})

	it('keeps vertex colors whose alpha says something', async () => {
		const result = await new ModelLoader().parseGLBToThreeJS(
			await coloredGlassGlb([{ size: 4, color: [0.3, 0.3, 0.3, 1] }])
		)

		expect(vertexColored(meshesOf(result.scene)[0])).toBe(true)
	})

	it('keeps dark vertex colors that state no alpha at all', async () => {
		const result = await new ModelLoader().parseGLBToThreeJS(
			await coloredGlassGlb([{ size: 3, color: [0.05, 0.05, 0.05] }])
		)

		expect(vertexColored(meshesOf(result.scene)[0])).toBe(true)
	})

	it('leaves the shared material alone for a primitive whose colors are real', async () => {
		const result = await new ModelLoader().parseGLBToThreeJS(
			await coloredGlassGlb([
				{ size: 4, color: [0.3, 0.3, 0.3, 0] },
				{ size: 4, color: [0.3, 0.3, 0.3, 1] }
			])
		)

		const [noColor, real] = meshesOf(result.scene)
		expect(vertexColored(noColor)).toBe(false)
		expect(vertexColored(real)).toBe(true)
	})
})
