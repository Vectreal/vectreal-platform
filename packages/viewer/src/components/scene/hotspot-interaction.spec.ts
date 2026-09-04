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
				}).announces
			).toBe('pressed')
			expect(
				resolveHotspotInteraction(linked, {
					occluded: false,
					canActivate: true
				}).announces
			).toBeNull()
		})
	})

	describe('revealing content', () => {
		const reveal = { occluded: false, canActivate: false, canReveal: true }

		it('makes a marker with something to say a button', () => {
			const interaction = resolveHotspotInteraction(unlinked, reveal)

			expect(interaction.role).toBe('button')
			expect(interaction.action).toBe('reveal')
			expect(interaction.focusable).toBe(true)
		})

		it('announces a reveal as expanded, never as pressed', () => {
			// The two are different claims about the same control. A reveal shows
			// content; a press picks the marker up. Announcing one as the other
			// tells a screen reader the wrong thing about what a click will do.
			expect(resolveHotspotInteraction(unlinked, reveal).announces).toBe(
				'expanded'
			)
		})

		it('lets selection win, and announces the selection', () => {
			// Selecting is local and reversible. An editing surface that offers
			// both has to give a click the cheap one.
			const interaction = resolveHotspotInteraction(linked, {
				occluded: false,
				canActivate: true,
				canReveal: true,
				canSelect: true
			})

			expect(interaction.action).toBe('select')
			expect(interaction.announces).toBe('pressed')
			// And never flies away from the viewpoint the author is composing in.
			expect(interaction.fliesCamera).toBe(false)
		})

		it('reveals and flies on the same click', () => {
			// A marker that has something to say and a camera to fly says "look
			// here, and here is why". The flight is what puts the content's
			// subject on screen, so they are not alternatives.
			const interaction = resolveHotspotInteraction(linked, {
				occluded: false,
				canActivate: true,
				canReveal: true
			})

			expect(interaction.action).toBe('reveal')
			expect(interaction.fliesCamera).toBe(true)
		})

		it('flies alone when there is nothing to reveal', () => {
			const interaction = resolveHotspotInteraction(linked, {
				occluded: false,
				canActivate: true
			})

			expect(interaction.action).toBe('activate')
			expect(interaction.fliesCamera).toBe(true)
		})

		it('does neither while occluded, and still announces expanded', () => {
			const interaction = resolveHotspotInteraction(linked, {
				occluded: true,
				canActivate: true,
				canReveal: true
			})

			expect(interaction.action).toBe('none')
			expect(interaction.fliesCamera).toBe(false)
			expect(interaction.announces).toBe('expanded')
			expect(interaction.pointerEvents).toBe('none')
		})
	})
})
