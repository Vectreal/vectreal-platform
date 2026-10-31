import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { writeOcclusionBake } from './write-occlusion'

// The smallest valid PNG, one grey pixel; the writer never decodes it.
const PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
)

describe('writeOcclusionBake', () => {
	it('stores the bake as the occlusion texture any glTF viewer reads', async () => {
		const document = new Document()
		document.createBuffer()
		const material = document.createMaterial('body')
		document.createScene().addChild(
			document.createNode().setMesh(
				document.createMesh().addPrimitive(
					document
						.createPrimitive()
						.setMaterial(material)
						.setAttribute(
							'POSITION',
							document
								.createAccessor()
								.setType('VEC3')
								.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
						)
				)
			)
		)

		writeOcclusionBake(document, [
			{ material, image: PNG, mimeType: 'image/png' }
		])

		const io = new WebIO()
		const reread = await io.readBinary(await io.writeBinary(document))
		const [stored] = reread.getRoot().listMaterials()
		expect(stored.getOcclusionTexture()?.getImage()).toEqual(PNG)
		expect(stored.getOcclusionTexture()?.getMimeType()).toBe('image/png')
		expect(stored.getOcclusionTextureInfo()?.getTexCoord()).toBe(0)
		expect(stored.getOcclusionStrength()).toBe(1)
	})
})
