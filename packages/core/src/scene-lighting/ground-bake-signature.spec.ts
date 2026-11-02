import { describe, expect, it } from 'vitest'

import {
	computeBakeSignature,
	groundBakeSignatureOptions,
	isGroundBakeMissing,
	isPersistedBakeValid,
	type BakeSignatureOptions
} from './ground-bake-signature'
import { resolveLighting } from './resolve-lighting'

import type { SceneSettings } from '../types/scene-types'

const options: BakeSignatureOptions = {
	lights: [{ azimuth: 30, elevation: 50, size: 20, intensity: 1 }],
	rotation: 0,
	frames: 48,
	scale: 2.5,
	resolution: 1024
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

		it('refuses it once a light moves, or the environment turns it', () => {
			const moved = {
				...options,
				lights: [{ ...options.lights[0], elevation: 60 }]
			}
			expect(isPersistedBakeValid(baked, moved, publishedModel)).toBe(false)
			expect(
				isPersistedBakeValid(
					baked,
					{ ...options, rotation: 45 },
					publishedModel
				)
			).toBe(false)
			expect(
				isPersistedBakeValid(baked, { ...options, lights: [] }, publishedModel)
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

	describe('from an earlier signature format', () => {
		// Every scene published before the format last changed carries one, and
		// re-baking it live put a 48-frame, eight-light bake on every visit.
		const baked = { signature: 'v2:5556afa3', basis: editorBasis }
		const showing = { acceptOlderFormat: true }

		it('keeps the stored bake where the settings are the ones it was saved with', () => {
			expect(
				isPersistedBakeValid(baked, options, publishedModel, showing)
			).toBe(true)
		})

		it('refuses it by default, where the settings may have moved on', () => {
			// An editor: a lighting change must re-bake, and the save must not
			// write the old token back.
			expect(isPersistedBakeValid(baked, options, publishedModel)).toBe(false)
		})

		it('still refuses a current-format token that no longer matches', () => {
			expect(
				isPersistedBakeValid(
					{ signature: 'v3:00000000', basis: editorBasis },
					options,
					publishedModel,
					showing
				)
			).toBe(false)
		})

		it('does not extend to an old token without a basis', () => {
			expect(
				isPersistedBakeValid(
					{ signature: 'v2:5556afa3' },
					options,
					publishedModel,
					showing
				)
			).toBe(false)
		})
	})

	it('cannot accept a bake without a basis when there is no model to check', () => {
		expect(
			isPersistedBakeValid({ signature: signed(editorBasis) }, options)
		).toBe(false)
	})
})

describe('isGroundBakeMissing', () => {
	const lighting: NonNullable<SceneSettings['lighting']> = {
		lights: [
			{ role: 'key', azimuth: 30, elevation: 50, size: 20, intensity: 1 }
		],
		ground: { enabled: true }
	}
	const currentBake = () => {
		const bakeOptions = groundBakeSignatureOptions(
			resolveLighting({ lighting })
		)
		return {
			assetId: 'bake',
			signature: computeBakeSignature(
				bakeOptions,
				editorBasis.footprint,
				editorBasis.radius,
				editorBasis.vertexCount
			),
			basis: editorBasis
		}
	}

	it('is false for a scene whose stored bake matches its lighting', () => {
		expect(
			isGroundBakeMissing({ lighting, shadows: { baked: currentBake() } })
		).toBe(false)
	})

	it('is true once the lighting has moved on from the stored bake', () => {
		const moved = {
			...lighting,
			lights: [{ ...lighting.lights![0], azimuth: 120 }]
		}
		expect(
			isGroundBakeMissing({
				lighting: moved,
				shadows: { baked: currentBake() }
			})
		).toBe(true)
	})

	it('is true for a scene with a ground shadow and nothing stored', () => {
		expect(isGroundBakeMissing({ lighting })).toBe(true)
	})

	it('is false for a scene that draws no ground shadow', () => {
		expect(
			isGroundBakeMissing({
				lighting: { ...lighting, ground: { enabled: false } }
			})
		).toBe(false)
	})

	it('keeps a stored bake from an earlier format', () => {
		expect(
			isGroundBakeMissing({
				lighting,
				shadows: {
					baked: {
						assetId: 'bake',
						signature: 'v2:5556afa3',
						basis: editorBasis
					}
				}
			})
		).toBe(false)
	})
})
