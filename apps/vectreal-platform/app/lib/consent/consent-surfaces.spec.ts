import { describe, expect, it } from 'vitest'

import { shouldRenderConsentUi } from './consent-surfaces'

describe('shouldRenderConsentUi', () => {
	it('never renders consent UI inside an external embed', () => {
		expect(
			shouldRenderConsentUi(
				'/embed/395a09f0-9340-42f2-ac98-03339cf27c9c/bae36111-22da-46a4-85c5-2d9bfdbb8f4f'
			)
		).toBe(false)
	})

	it('suppresses it for any embed path', () => {
		expect(shouldRenderConsentUi('/embed/anything/at-all')).toBe(false)
	})

	it('renders it on ordinary marketing and app routes', () => {
		for (const pathname of [
			'/',
			'/news-room',
			'/news-room/camera-presets-and-transitions',
			'/pricing',
			'/dashboard',
			'/publisher'
		]) {
			expect(shouldRenderConsentUi(pathname)).toBe(true)
		}
	})

	it('does not suppress a route that merely starts with the word embed', () => {
		// `/embed/` with the trailing slash, not a bare prefix match, so docs
		// pages such as /docs/packages/embed keep their banner.
		expect(shouldRenderConsentUi('/docs/packages/embed')).toBe(true)
		expect(shouldRenderConsentUi('/embedded-analytics')).toBe(true)
	})
})
