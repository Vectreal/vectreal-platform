/**
 * `compressGeometry` replaces the document like any other step, so its commit
 * has to retire work started on the document it replaced.
 *
 * Draco cannot encode outside a browser, so the encode is stubbed: it hands
 * back a clone as the "compressed" document, which is all the commit reads.
 */
import { Document, WebIO } from '@gltf-transform/core'
import { cloneDocument } from '@gltf-transform/functions'
import { describe, expect, it, vi } from 'vitest'

import { ModelOptimizer, SupersededError } from './model-optimizer'

import type { DracoCompressionReport } from './types'

vi.mock('./draco-compression', () => ({
	encodeDracoCopy: async (document: Document) => ({
		workingDoc: cloneDocument(document),
		report: { isWorthApplying: true } as DracoCompressionReport
	})
}))

const io = new WebIO()

async function glb(): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const positions = new Float32Array(300 * 3).map((_, i) => Math.sin(i * 0.37))
	const accessor = document.createAccessor().setType('VEC3').setArray(positions)
	const mesh = document
		.createMesh()
		.addPrimitive(document.createPrimitive().setAttribute('POSITION', accessor))
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return io.writeBinary(document)
}

describe('ModelOptimizer.compressGeometry', () => {
	it('retires a step started on the document it replaced', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())

		// Held so the order is forced: the step reads the document, then waits
		// while compression replaces it.
		const io = (optimizer as unknown as { io: WebIO }).io
		const writeBinary = io.writeBinary.bind(io)
		let releaseWrite: () => void = () => {}
		const writeHeld = new Promise<void>((resolve) => (releaseWrite = resolve))
		vi.spyOn(io, 'writeBinary').mockImplementation(async (document) => {
			await writeHeld
			return writeBinary(document)
		})

		const step = optimizer.quantize()
		await optimizer.compressGeometry()
		const compressed = optimizer.document
		releaseWrite()

		await expect(step).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.document).toBe(compressed)
		expect(optimizer.getAppliedOptimizations()).toEqual(['draco compression'])
	})
})
