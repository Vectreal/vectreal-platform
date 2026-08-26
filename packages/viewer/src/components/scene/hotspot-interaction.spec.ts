import { describe, expect, it } from 'vitest'

import { resolveHotspotInteraction } from './hotspot-interaction'

const linked = { linkedCameraId: 'camera-1' }
const unlinked = { linkedCameraId: null }

describe('resolveHotspotInteraction', () => {
	it('is a button only when there is a camera to reach and somewhere to send it', () => {
		expect(
			resolveHotspotInteraction(linked, { occluded: false, canActivate: true })
				.role
		).toBe('button')
		expect(
			resolveHotspotInteraction(linked, { occluded: false, canActivate: false })
				.role
		).toBe('image')
		expect(
			resolveHotspotInteraction(unlinked, {
				occluded: false,
				canActivate: true
			}).role
		).toBe('image')
	})

	it('keeps the same role while occluded', () => {
		// The rule this pins: changing the element type mid-orbit unmounts the
		// focused button and drops the user's place in the tab order.
		expect(
			resolveHotspotInteraction(linked, { occluded: true, canActivate: true })
				.role
		).toBe('button')
	})

	it('takes the pointer away from every occluded marker, linked or not', () => {
		for (const marker of [linked, unlinked]) {
			expect(
				resolveHotspotInteraction(marker, { occluded: true, canActivate: true })
					.pointerEvents
			).toBe('none')
		}
	})

	it('leaves the pointer on a marker in plain view', () => {
		for (const marker of [linked, unlinked]) {
			expect(
				resolveHotspotInteraction(marker, {
					occluded: false,
					canActivate: true
				}).pointerEvents
			).toBe('auto')
		}
	})

	it('refuses to activate an occluded marker', () => {
		expect(
			resolveHotspotInteraction(linked, { occluded: true, canActivate: true })
				.activatable
		).toBe(false)
		expect(
			resolveHotspotInteraction(linked, { occluded: false, canActivate: true })
				.activatable
		).toBe(true)
	})

	it('drops an occluded marker out of the tab order', () => {
		expect(
			resolveHotspotInteraction(linked, { occluded: true, canActivate: true })
				.focusable
		).toBe(false)
		expect(
			resolveHotspotInteraction(linked, { occluded: false, canActivate: true })
				.focusable
		).toBe(true)
	})
})
