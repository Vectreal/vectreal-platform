import { Document } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'

import { bakeOcclusionIntoDocument } from './bake-into-document'

describe('bakeOcclusionIntoDocument', () => {
	it('asks for no renderer when nothing can be baked, and says why', async () => {
		const document = new Document()
		const primitive = document
			.createPrimitive()
			.setMaterial(document.createMaterial('plain'))
			.setAttribute(
				'POSITION',
				document
					.createAccessor()
					.setType('VEC3')
					.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
			)
		document
			.createScene()
			.addChild(
				document
					.createNode()
					.setMesh(document.createMesh().addPrimitive(primitive))
			)
		const renderer = vi.fn()

		const report = await bakeOcclusionIntoDocument(document, renderer)

		expect(renderer).not.toHaveBeenCalled()
		expect(report).toEqual({
			baked: [],
			skipped: [{ material: 'plain', reason: 'no-uv0' }]
		})
	})
})
