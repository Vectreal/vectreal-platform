import { Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { DEFAULT_OCCLUSION_BAKE_OPTIONS } from './options'
import { planOcclusionBake } from './plan'
import { occlusionBakeSignature } from './signature'

function quadDocument({
	translation = [0, 0, 0] as [number, number, number],
	uvMax = 1,
	alphaMode = 'OPAQUE' as 'OPAQUE' | 'BLEND'
} = {}) {
	const document = new Document()
	const vec = (type: 'VEC2' | 'VEC3', values: number[]) =>
		document.createAccessor().setType(type).setArray(new Float32Array(values))
	const primitive = document
		.createPrimitive()
		.setAttribute('POSITION', vec('VEC3', [0, 0, 0, 1, 0, 0, 0, 1, 0]))
		.setAttribute('TEXCOORD_0', vec('VEC2', [0, 0, uvMax, 0, 0, uvMax]))
		.setMaterial(document.createMaterial('m').setAlphaMode(alphaMode))
	document
		.createScene()
		.addChild(
			document
				.createNode()
				.setTranslation(translation)
				.setMesh(document.createMesh().addPrimitive(primitive))
		)
	return document
}

const signatureOf = (
	document: Document,
	options = DEFAULT_OCCLUSION_BAKE_OPTIONS
) => occlusionBakeSignature(planOcclusionBake(document), options)

describe('occlusionBakeSignature', () => {
	it('is the same for the same scene and options', () => {
		expect(signatureOf(quadDocument())).toBe(signatureOf(quadDocument()))
	})

	it('changes with anything that changes the pixels', () => {
		const base = signatureOf(quadDocument())

		expect(signatureOf(quadDocument({ translation: [0, 1, 0] }))).not.toBe(base)
		expect(signatureOf(quadDocument({ uvMax: 0.5 }))).not.toBe(base)
		expect(signatureOf(quadDocument({ alphaMode: 'BLEND' }))).not.toBe(base)
		expect(
			signatureOf(quadDocument(), {
				...DEFAULT_OCCLUSION_BAKE_OPTIONS,
				samples: 64
			})
		).not.toBe(base)
	})
})
