import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { ModelLoader } from './model-loader'

import type { Mesh } from 'three'

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
})
