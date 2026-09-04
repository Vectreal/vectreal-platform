import { describe, expect, it } from 'vitest'

import {
	resolveEmbedBranding,
	shouldShowVectrealBranding
} from './embed-branding-policy'

describe('shouldShowVectrealBranding', () => {
	it('shows the mark on a plan that has not bought its removal', () => {
		expect(shouldShowVectrealBranding({ granted: false })).toBe(true)
	})

	it('removes it once the plan grants removal', () => {
		// The inversion this module exists for. `granted` means the customer
		// bought the *removal*, so granted and "shows branding" are opposites.
		expect(shouldShowVectrealBranding({ granted: true })).toBe(false)
	})
})

describe('resolveEmbedBranding', () => {
	it('takes the decision the loader made', () => {
		expect(resolveEmbedBranding({ showsVectrealBranding: false })).toBe(false)
		expect(resolveEmbedBranding({ showsVectrealBranding: true })).toBe(true)
	})

	it('shows the mark when the loader left no decision', () => {
		// A refused load - rate limited, bad token, scene not found - returns a
		// response instead of throwing, so the document still renders and this
		// is the only thing standing between that and an unbranded scene.
		expect(resolveEmbedBranding(undefined)).toBe(true)
		expect(resolveEmbedBranding({})).toBe(true)
	})
})
