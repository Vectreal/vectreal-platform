import { Document, WebIO } from '@gltf-transform/core'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { ModelLoader } from './model-loader'

import type { Mesh } from 'three'

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
