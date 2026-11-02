import * as core from '@vctrl/core'
import {
	computeBakeSignature,
	groundBakeSignatureOptions,
	PERSISTED_BAKE_FILENAME,
	resolveLighting,
	type SceneSettings
} from '@vctrl/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isPublishedShadowNotStored } from './ground-bake-note'

const lighting: NonNullable<SceneSettings['lighting']> = {
	lights: [{ role: 'key', azimuth: 30, elevation: 50, size: 20, intensity: 1 }],
	ground: { enabled: true }
}
const basis = { footprint: 1.2, radius: 0.9, vertexCount: 18_432 }
const storedBake = {
	assetId: 'bake',
	signature: computeBakeSignature(
		groundBakeSignatureOptions(resolveLighting({ lighting })),
		basis.footprint,
		basis.radius,
		basis.vertexCount
	),
	basis
}
/** The bake image as an embed serves it. */
const bakeRef = {
	bake: {
		url: 'https://assets.example/bake.png',
		fileName: PERSISTED_BAKE_FILENAME,
		mimeType: 'image/png',
		byteSize: 1024
	}
}

/** What a published scene's manifest carries. */
const published = (
	settings: SceneSettings | null,
	assetRefs: core.SceneAssetRefMap = bakeRef
) => ({ isPublished: true, manifest: { settings, assetRefs } })

describe('isPublishedShadowNotStored', () => {
	afterEach(() => vi.restoreAllMocks())

	it('says nothing when the stored bake matches and its image is served', () => {
		expect(
			isPublishedShadowNotStored(
				published({ lighting, shadows: { baked: storedBake } })
			)
		).toBe(false)
	})

	it('asks a published scene with no stored bake to publish again', () => {
		expect(isPublishedShadowNotStored(published({ lighting }, {}))).toBe(true)
	})

	it('asks once the lighting has moved on from the stored bake', () => {
		expect(
			isPublishedShadowNotStored(
				published({
					lighting: {
						...lighting,
						lights: [{ ...lighting.lights![0], elevation: 70 }]
					},
					shadows: { baked: storedBake }
				})
			)
		).toBe(true)
	})

	// The viewer draws no bake it has no image for, whatever the signature.
	it('asks when the bake matches but its image is not served', () => {
		expect(
			isPublishedShadowNotStored(
				published({ lighting, shadows: { baked: storedBake } }, {})
			)
		).toBe(true)
	})

	// Published before the signature format last changed, and still shown.
	it('says nothing for a bake stored in an older signature format', () => {
		expect(
			isPublishedShadowNotStored(
				published({
					lighting,
					shadows: { baked: { ...storedBake, signature: 'v2:0badc0de' } }
				})
			)
		).toBe(false)
	})

	it('says nothing for a draft, which publishing will bake', () => {
		expect(
			isPublishedShadowNotStored({
				...published({ lighting }, {}),
				isPublished: false
			})
		).toBe(false)
	})

	// Whatever core would answer for no settings at all: nothing is known.
	it('says nothing when the settings could not be read', () => {
		vi.spyOn(core, 'isGroundBakeMissing').mockReturnValue(true)

		expect(isPublishedShadowNotStored(published(null))).toBe(false)
		expect(
			isPublishedShadowNotStored({ isPublished: true, manifest: null })
		).toBe(false)
	})
})
