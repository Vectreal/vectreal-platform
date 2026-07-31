import {
	calculateDracoCompressedGeometrySize,
	readGlbJsonChunk
} from '@vctrl/core'

import type { JSONDocument } from '@gltf-transform/core'

const GLB_HEADER_BYTES = 12
const GLB_CHUNK_HEADER_BYTES = 8

/**
 * Packs glTF JSON into a minimal GLB, mirroring what `io.writeBinary` emits.
 * The measurement path reads its numbers straight back out of written bytes
 * rather than serializing a second time, so the chunk parsing is what needs
 * covering — not the Draco encoder, which is browser/WASM only.
 */
function buildGlb(json: unknown): Uint8Array {
	const jsonBytes = new TextEncoder().encode(JSON.stringify(json))
	const paddedLength = Math.ceil(jsonBytes.byteLength / 4) * 4
	const total = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES + paddedLength

	const glb = new Uint8Array(total)
	const view = new DataView(glb.buffer)

	view.setUint32(0, 0x46546c67, true) // 'glTF'
	view.setUint32(4, 2, true)
	view.setUint32(8, total, true)
	view.setUint32(12, paddedLength, true)
	view.setUint32(16, 0x4e4f534a, true) // 'JSON'

	glb.set(jsonBytes, GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES)
	// Spec requires the JSON chunk be space-padded to a 4-byte boundary.
	glb.fill(0x20, GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES + jsonBytes.byteLength)

	return glb
}

const dracoJson = {
	asset: { version: '2.0' },
	extensionsUsed: ['KHR_draco_mesh_compression'],
	extensionsRequired: ['KHR_draco_mesh_compression'],
	bufferViews: [
		{ buffer: 0, byteOffset: 0, byteLength: 1000 },
		{ buffer: 0, byteOffset: 1000, byteLength: 250 },
		{ buffer: 0, byteOffset: 1250, byteLength: 90 }
	],
	meshes: [
		{
			primitives: [
				{
					extensions: {
						KHR_draco_mesh_compression: { bufferView: 1, attributes: {} }
					}
				},
				{
					extensions: {
						KHR_draco_mesh_compression: { bufferView: 2, attributes: {} }
					}
				}
			]
		}
	]
}

describe('readGlbJsonChunk', () => {
	it('round-trips the JSON chunk of a GLB', () => {
		expect(readGlbJsonChunk(buildGlb(dracoJson))).toEqual(dracoJson)
	})

	it('reads a GLB sitting at a non-zero byte offset in its ArrayBuffer', () => {
		const glb = buildGlb(dracoJson)
		const padded = new Uint8Array(glb.byteLength + 8)
		padded.set(glb, 8)

		expect(readGlbJsonChunk(padded.subarray(8))).toEqual(dracoJson)
	})

	it('rejects bytes that are not a GLB', () => {
		expect(() => readGlbJsonChunk(new Uint8Array(32))).toThrow(/glTF/)
	})

	it('rejects a buffer too short to hold a chunk header', () => {
		expect(() => readGlbJsonChunk(new Uint8Array(12))).toThrow(
			/expected at least 20 bytes/
		)
	})

	it('rejects a JSON chunk length running past the buffer', () => {
		const glb = buildGlb(dracoJson)
		new DataView(glb.buffer, glb.byteOffset, glb.byteLength).setUint32(
			12,
			glb.byteLength * 2,
			true
		)

		expect(() => readGlbJsonChunk(glb)).toThrow(/JSON chunk declares/)
	})
})

describe('calculateDracoCompressedGeometrySize', () => {
	it('sums the bufferViews referenced by compressed primitives', () => {
		const json = readGlbJsonChunk(buildGlb(dracoJson))

		expect(calculateDracoCompressedGeometrySize(json)).toBe(340)
	})

	it('counts a shared bufferView once', () => {
		const shared = structuredClone(dracoJson)
		shared.meshes[0].primitives[1].extensions.KHR_draco_mesh_compression.bufferView = 1

		expect(
			calculateDracoCompressedGeometrySize(
				readGlbJsonChunk(buildGlb(shared)) as JSONDocument['json']
			)
		).toBe(250)
	})

	it('returns zero when nothing is Draco-compressed', () => {
		const plain = {
			asset: { version: '2.0' },
			bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 1000 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }]
		}

		expect(
			calculateDracoCompressedGeometrySize(
				readGlbJsonChunk(buildGlb(plain)) as JSONDocument['json']
			)
		).toBe(0)
	})
})
