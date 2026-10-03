import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { DRACO_EXTENSION, readGlbExtensionsUsed } from './glb-header'

/** A GLB holding only a JSON chunk, laid out as the spec requires. */
function glbFromJson(json: object): Uint8Array {
	const text = new TextEncoder().encode(JSON.stringify(json))
	const padded = Math.ceil(text.byteLength / 4) * 4
	const bytes = new Uint8Array(12 + 8 + padded).fill(0x20, 20)
	const view = new DataView(bytes.buffer)
	view.setUint32(0, 0x46546c67, true)
	view.setUint32(4, 2, true)
	view.setUint32(8, bytes.byteLength, true)
	view.setUint32(12, padded, true)
	view.setUint32(16, 0x4e4f534a, true)
	bytes.set(text, 20)
	return bytes
}

const glb = async (withDraco: boolean) =>
	glbFromJson({
		asset: { version: '2.0' },
		...(withDraco ? { extensionsUsed: [DRACO_EXTENSION] } : {})
	})

describe('readGlbExtensionsUsed', () => {
	it('reads a Draco GLB as using Draco', async () => {
		expect(readGlbExtensionsUsed(await glb(true))).toContain(DRACO_EXTENSION)
	})

	it('reads a GLB as glTF-Transform writes one, as the publisher does', async () => {
		const document = new Document()
		document.createScene().addChild(document.createNode('empty'))
		const bytes = await new WebIO().writeBinary(document)
		expect(readGlbExtensionsUsed(bytes)).toEqual([])
	})

	it('reads a plain GLB as using nothing', async () => {
		expect(readGlbExtensionsUsed(await glb(false))).toEqual([])
	})

	it('reads a GLB from a view into a larger buffer', async () => {
		const bytes = await glb(true)
		const padded = new Uint8Array(bytes.byteLength + 8)
		padded.set(bytes, 4)
		expect(
			readGlbExtensionsUsed(padded.subarray(4, 4 + bytes.byteLength))
		).toContain(DRACO_EXTENSION)
	})

	it('refuses bytes that are not a GLB', () => {
		expect(readGlbExtensionsUsed(new Uint8Array(32))).toBeNull()
		expect(
			readGlbExtensionsUsed(new TextEncoder().encode('{"asset":{}}'))
		).toBeNull()
	})

	it('refuses a JSON chunk that runs past the end of the file', async () => {
		const bytes = await glb(false)
		expect(readGlbExtensionsUsed(bytes.subarray(0, 24))).toBeNull()
	})
})
