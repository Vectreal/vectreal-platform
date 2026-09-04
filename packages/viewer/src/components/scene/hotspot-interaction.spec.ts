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
				.action
		).toBe('none')
		expect(
			resolveHotspotInteraction(linked, { occluded: false, canActivate: true })
				.action
		).toBe('activate')
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

	describe('an editing surface that can select', () => {
		it('is a button when the surface can select it, with or without a camera', () => {
			// The whole point of drawing a camera-less marker in an editor is being
			// able to pick it, so selection cannot borrow the camera's gate.
			expect(
				resolveHotspotInteraction(unlinked, {
					occluded: false,
					canActivate: false,
					canSelect: true
				}).role
			).toBe('button')
		})

		it('selects rather than activates when a surface offers both', () => {
			// Selecting is local and reversible; flying the camera throws away the
			// viewpoint the author was working from.
			expect(
				resolveHotspotInteraction(linked, {
					occluded: false,
					canActivate: true,
					canSelect: true
				}).action
			).toBe('select')
		})

		it('activates when the surface is not offering selection', () => {
			expect(
				resolveHotspotInteraction(linked, {
					occluded: false,
					canActivate: true,
					canSelect: false
				}).action
			).toBe('activate')
			expect(
				resolveHotspotInteraction(unlinked, {
					occluded: false,
					canActivate: true,
					canSelect: false
				}).action
			).toBe('none')
		})

		it('does nothing on an occluded marker, whichever action it would have had', () => {
			expect(
				resolveHotspotInteraction(linked, {
					occluded: true,
					canActivate: true,
					canSelect: true
				}).action
			).toBe('none')
		})

		it('keeps a selectable marker in the tab order, and drops it when occluded', () => {
			expect(
				resolveHotspotInteraction(unlinked, {
					occluded: false,
					canActivate: false,
					canSelect: true
				}).focusable
			).toBe(true)
			expect(
				resolveHotspotInteraction(unlinked, {
					occluded: true,
					canActivate: false,
					canSelect: true
				}).focusable
			).toBe(false)
		})

		it('goes on announcing a selectable marker as a toggle while occluded', () => {
			// `aria-pressed` appearing and disappearing as the model turns would
			// change what the control claims to be under a screen reader.
			expect(
				resolveHotspotInteraction(unlinked, {
					occluded: true,
					canActivate: false,
					canSelect: true
				}).toggles
			).toBe(true)
			expect(
				resolveHotspotInteraction(linked, {
					occluded: false,
					canActivate: true
				}).toggles
			).toBe(false)
		})
	})

	describe('yielding the hit box to an editing gizmo', () => {
		/**
		 * The publisher mounts a transform gizmo on the selected hotspot, and the
		 * marker's own 24px hit box sits directly over the gizmo's centre handle.
		 * The 24px floor is a deliberate touch target, so the marker gives the
		 * pointer up rather than shrinking - the click it would have taken is a
		 * re-selection of the marker already selected.
		 */
		it('takes no pointer while it is the selected marker', () => {
			expect(
				resolveHotspotInteraction(linked, {
					occluded: false,
					canActivate: true,
					canSelect: true,
					selected: true
				}).pointerEvents
			).toBe('none')
		})

		it('leaves every other marker live, which is what keeps this narrow', () => {
			expect(
				resolveHotspotInteraction(linked, {
					occluded: false,
					canActivate: true,
					canSelect: true,
					selected: false
				}).pointerEvents
			).toBe('auto')
		})

		it('changes nothing else about the marker', () => {
			// Not disabled and not dropped from the tab order: it still announces
			// itself the same way, and a keyboard still reaches it.
			const selectedMarker = resolveHotspotInteraction(linked, {
				occluded: false,
				canActivate: true,
				canSelect: true,
				selected: true
			})

			expect(selectedMarker.role).toBe('button')
			expect(selectedMarker.action).toBe('select')
			expect(selectedMarker.focusable).toBe(true)
		})
	})
})
