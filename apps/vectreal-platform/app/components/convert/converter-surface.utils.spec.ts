import { describe, expect, it } from 'vitest'

import {
	downloadContainer,
	measuredBytes,
	refusalMessage
} from './converter-surface.utils'
import { bundleSourceCopy } from '../../lib/convert/convert-capabilities'
import { convertPairBySlug } from '../../lib/convert/convert-pairs'

const file = (name: string, size: number) =>
	new File([new Uint8Array(size)], name)

describe('downloadContainer', () => {
	it('names the container only when it is not the format itself', () => {
		expect(downloadContainer('model.glb', 'glb')).toBe('')
		expect(downloadContainer('model.zip', 'gltf')).toBe(' (.zip)')
	})
})

describe('measuredBytes', () => {
	it('counts a single-file model alone, not what was dropped beside it', () => {
		expect(measuredBytes([file('a.glb', 10), file('a.blend', 90)])).toBe(10)
	})

	it('counts a bundle as its whole selection', () => {
		expect(measuredBytes([file('a.gltf', 10), file('a.bin', 30)])).toBe(40)
	})

	it('counts everything when nothing in it is a model', () => {
		expect(measuredBytes([file('a.png', 5), file('b.png', 7)])).toBe(12)
	})
})

describe('refusalMessage', () => {
	const glb = convertPairBySlug('glb-to-gltf')!
	const gltf = convertPairBySlug('gltf-to-glb')!
	const gltfCopy = bundleSourceCopy('gltf')

	it('asks a bundle page for one model, not for fewer files', () => {
		const error = { code: 'multiple_models' } as never
		expect(refusalMessage(error, glb, null)).toMatch(/Drop one at a time/)
		expect(refusalMessage(error, gltf, gltfCopy)).toMatch(/more than one model/)
		expect(refusalMessage(error, gltf, gltfCopy)).not.toMatch(/one at a time/)
	})

	it('never asks for sibling files about a file that would not parse', () => {
		const error = { code: 'gltf_load_failed' } as never
		expect(refusalMessage(error, gltf, gltfCopy)).toBe(
			`Check it is a valid ${gltf.fromLabel}.`
		)
	})

	it('falls back to the bundle refusal, then to the format sentence', () => {
		expect(refusalMessage(null, gltf, gltfCopy)).toBe(gltfCopy!.refusal)
		expect(refusalMessage(null, glb, null)).toBe(
			`Check it is a valid ${glb.fromLabel}.`
		)
	})
})
