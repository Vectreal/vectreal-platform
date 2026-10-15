import { PERSISTED_BAKE_FILENAME } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { resolveBakedShadowSource } from './baked-shadow-source'

const shadows = {
	enabled: true,
	baked: { assetId: 'bake-1', signature: 'sig' }
}

const bakeRef = {
	url: '/api/scenes/s1/assets/bake-1?exp=1&sig=abc',
	fileName: PERSISTED_BAKE_FILENAME,
	mimeType: 'image/png',
	byteSize: 4
}

const bakeBytes = {
	fileName: PERSISTED_BAKE_FILENAME,
	mimeType: 'image/png',
	data: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
}

describe('resolveBakedShadowSource', () => {
	it('loads a referenced bake straight from its URL', () => {
		expect(
			resolveBakedShadowSource(shadows, { assetRefs: { 'bake-1': bakeRef } })
		).toEqual({ url: bakeRef.url, signature: 'sig' })
	})

	it('prefers the reference over bytes for the same bake', () => {
		expect(
			resolveBakedShadowSource(shadows, {
				assetRefs: { 'bake-1': bakeRef },
				assetData: { 'bake-1': bakeBytes } as never
			})?.url
		).toBe(bakeRef.url)
	})

	it('turns bytes into a data URL when there is no reference', () => {
		expect(
			resolveBakedShadowSource(shadows, {
				assetData: { 'bake-1': bakeBytes } as never
			})
		).toEqual({ url: 'data:image/png;base64,iVBORw==', signature: 'sig' })
	})

	it('resolves nothing for a scene with no stored bake', () => {
		expect(
			resolveBakedShadowSource(
				{ enabled: true },
				{ assetRefs: { 'bake-1': bakeRef } }
			)
		).toBeUndefined()
		expect(resolveBakedShadowSource(shadows, {})).toBeUndefined()
	})
})
