import { describe, expect, it } from 'vitest'

import {
	computeBakeSignature,
	isPersistedBakeValid,
	type BakeSignatureOptions
} from './shadow-bake'

const options: BakeSignatureOptions = {
	light: { position: [0, 2.5, 0], radius: 0.8, amount: 8 },
	frames: 48,
	scale: 2.5,
	resolution: 1024,
	alphaTest: 3,
	colorBlend: 2,
	cutoffScale: 1
}

/** The editor model the bake was captured on. */
const editorBasis = { footprint: 1.2, radius: 0.9, vertexCount: 18_432 }
/**
 * The same model as an embed loads it: Draco's weld merged duplicate
 * vertices, and quantization moved the bounds by a hair.
 */
const publishedModel = {
	footprint: 1.2004,
	radius: 0.8997,
	vertexCount: 6_144,
	measured: true
}

const signed = (basis: typeof editorBasis, bakeOptions = options) =>
	computeBakeSignature(
		bakeOptions,
		basis.footprint,
		basis.radius,
		basis.vertexCount
	)

describe('isPersistedBakeValid', () => {
	describe('with the basis the bake was captured on', () => {
		const baked = { signature: signed(editorBasis), basis: editorBasis }

		it('accepts the bake on the Draco-compressed published model', () => {
			expect(isPersistedBakeValid(baked, options, publishedModel)).toBe(true)
		})

		it('refuses it once a shadow setting changes', () => {
			expect(
				isPersistedBakeValid(baked, { ...options, frames: 24 }, publishedModel)
			).toBe(false)
		})
	})

	describe('without a basis, as bakes saved before it was recorded', () => {
		const baked = { signature: signed(editorBasis) }

		it('accepts the bake on the model it was captured on', () => {
			expect(
				isPersistedBakeValid(baked, options, {
					...editorBasis,
					measured: true
				})
			).toBe(true)
		})

		it('refuses it on a model measured differently', () => {
			expect(isPersistedBakeValid(baked, options, publishedModel)).toBe(false)
		})

		it('trusts it until the model is measured', () => {
			expect(
				isPersistedBakeValid(baked, options, {
					footprint: 1,
					radius: 1,
					vertexCount: 0,
					measured: false
				})
			).toBe(true)
		})
	})
})
