import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { GlbFormatError, SPLIT_BIN_FILE_NAME, splitGlb } from './glb-container'

/** A GLB as the spec lays it out: header, JSON chunk, optional BIN chunk. */
function glb(json: unknown, bin?: Uint8Array, version = 2): Uint8Array {
	const pad = (bytes: Uint8Array, fill: number) => {
		const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4).fill(
			fill
		)
		padded.set(bytes)
		return padded
	}
	const jsonChunk = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20)
	const binChunk = bin ? pad(bin, 0) : null
	const length =
		12 + 8 + jsonChunk.byteLength + (binChunk ? 8 + binChunk.byteLength : 0)

	const out = new Uint8Array(length)
	const view = new DataView(out.buffer)
	view.setUint32(0, 0x46546c67, true)
	view.setUint32(4, version, true)
	view.setUint32(8, length, true)
	view.setUint32(12, jsonChunk.byteLength, true)
	view.setUint32(16, 0x4e4f534a, true)
	out.set(jsonChunk, 20)
	if (binChunk) {
		const at = 20 + jsonChunk.byteLength
		view.setUint32(at, binChunk.byteLength, true)
		view.setUint32(at + 4, 0x004e4942, true)
		out.set(binChunk, at + 8)
	}
	return out
}

const asset = { version: '2.0' }
const readJson = (bytes: Uint8Array) =>
	JSON.parse(new TextDecoder().decode(bytes))

describe('splitGlb', () => {
	it('points the binary buffer at scene.bin and keeps the BIN chunk byte for byte', () => {
		const bin = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])

		const split = splitGlb(
			glb({ asset, buffers: [{ byteLength: 8 }], meshes: [{ name: 'm' }] }, bin)
		)

		expect(readJson(split.gltfJson)).toEqual({
			asset,
			buffers: [{ byteLength: 8, uri: SPLIT_BIN_FILE_NAME }],
			meshes: [{ name: 'm' }]
		})
		expect(split.bin).toEqual(bin)
	})

	it('splits a GLB without a BIN chunk into the JSON alone', () => {
		const split = splitGlb(glb({ asset, nodes: [{}] }))

		expect(readJson(split.gltfJson)).toEqual({ asset, nodes: [{}] })
		expect(split.bin).toBeNull()
	})

	it('passes a Draco-compressed model through without decoding it', () => {
		const bytes = new Uint8Array(
			readFileSync(
				join(import.meta.dirname, '../../../assets/models/rocket-balanced.glb')
			)
		)
		const view = new DataView(bytes.buffer, bytes.byteOffset)
		const jsonLength = view.getUint32(12, true)
		const binStart = 20 + jsonLength + 8
		const original = readJson(bytes.subarray(20, 20 + jsonLength))

		const split = splitGlb(bytes)

		expect(original.extensionsUsed).toContain('KHR_draco_mesh_compression')
		expect(split.bin).toEqual(
			bytes.subarray(binStart, binStart + view.getUint32(binStart - 8, true))
		)
		const json = readJson(split.gltfJson)
		expect(json.buffers[0].uri).toBe(SPLIT_BIN_FILE_NAME)
		expect({ ...json, buffers: undefined }).toEqual({
			...original,
			buffers: undefined
		})
	})

	it('keeps a meshopt fallback buffer, which has no data by design', () => {
		const fallback = {
			byteLength: 64,
			extensions: { EXT_meshopt_compression: { fallback: true } }
		}

		const split = splitGlb(
			glb({ asset, buffers: [{ byteLength: 4 }, fallback] }, new Uint8Array(4))
		)

		expect(readJson(split.gltfJson).buffers).toEqual([
			{ byteLength: 4, uri: SPLIT_BIN_FILE_NAME },
			fallback
		])
	})

	it('keeps data URIs, which are inside the file', () => {
		const uri = 'data:application/octet-stream;base64,AAAA'

		const split = splitGlb(glb({ asset, buffers: [{ uri, byteLength: 3 }] }))

		expect(readJson(split.gltfJson).buffers[0].uri).toBe(uri)
	})

	it.each([
		['a buffer', { buffers: [{ uri: 'scene.bin', byteLength: 4 }] }],
		['an image', { images: [{ uri: 'albedo.png' }] }]
	])('refuses %s stored outside the file', (_, json) => {
		expect(() => splitGlb(glb({ asset, ...json }))).toThrow(GlbFormatError)
	})

	it('refuses a buffer with no data', () => {
		expect(() =>
			splitGlb(glb({ asset, buffers: [{ byteLength: 4 }] }))
		).toThrow(GlbFormatError)
		expect(() =>
			splitGlb(
				glb(
					{ asset, buffers: [{ byteLength: 4 }, { byteLength: 4 }] },
					new Uint8Array(4)
				)
			)
		).toThrow(GlbFormatError)
	})

	it.each([
		['too short', new Uint8Array(8)],
		['not a GLB', new TextEncoder().encode('{"asset":{"version":"2.0"}}   ')],
		['glTF 1 binary', glb({ asset }, undefined, 1)],
		['a glTF 1 asset', glb({ asset: { version: '1.0' } })],
		['truncated', glb({ asset }, new Uint8Array(16)).subarray(0, 40)],
		['unreadable JSON', glb('not an object')]
	])('refuses a file that is %s', (_, bytes) => {
		expect(() => splitGlb(bytes)).toThrow(GlbFormatError)
	})
})
