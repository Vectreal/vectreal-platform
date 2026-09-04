import { describe, expect, it } from 'vitest'

import {
	resolveHotspotLink,
	resolveHotspotPopoverContent,
	resolveHotspotPopoverPlacement
} from './resolve-hotspot-popover'

describe('resolveHotspotLink', () => {
	it('takes an https URL and names it by its host', () => {
		expect(resolveHotspotLink('https://docs.vectreal.com/specs?a=1')).toEqual({
			href: 'https://docs.vectreal.com/specs?a=1',
			label: 'docs.vectreal.com'
		})
	})

	it('keeps a non-default port in the label, which is part of the host', () => {
		expect(resolveHotspotLink('https://staging.test:8443/a')?.label).toBe(
			'staging.test:8443'
		)
	})

	it.each([
		['a script URL', 'javascript:alert(1)'],
		['a script URL in mixed case', 'JavaScript:alert(1)'],
		['an inline document', 'data:text/html;base64,AAAA'],
		['plain http', 'http://vectreal.com'],
		['a protocol-relative URL', '//vectreal.com'],
		['a relative path', '/docs'],
		['a bare scheme', 'https://'],
		['an unparseable value behind the right prefix', 'https:// spaced'],
		['nothing at all', null]
	])('refuses %s', (_label, value) => {
		expect(resolveHotspotLink(value)).toBeNull()
	})

	/**
	 * The prefix is the gate, not the parsed protocol.
	 *
	 * `new URL('https:evil')` yields protocol `https:` with no host at all, so a
	 * rule written as "parse it and check `url.protocol`" accepts a value that
	 * is not an absolute https URL.
	 */
	it('refuses a scheme-only form that parses as https', () => {
		expect(resolveHotspotLink('https:evil')).toBeNull()
	})
})

describe('resolveHotspotPopoverContent', () => {
	it('carries a body on its own', () => {
		expect(
			resolveHotspotPopoverContent({
				body: 'Cast in one piece.',
				linkUrl: null
			})
		).toEqual({ body: 'Cast in one piece.', link: null })
	})

	it('carries a link on its own', () => {
		expect(
			resolveHotspotPopoverContent({ body: null, linkUrl: 'https://a.test/x' })
		).toEqual({
			body: null,
			link: { href: 'https://a.test/x', label: 'a.test' }
		})
	})

	it('has nothing to reveal when it carries neither', () => {
		expect(
			resolveHotspotPopoverContent({ body: null, linkUrl: null })
		).toBeNull()
	})

	/**
	 * A marker whose only content is a link the renderer refuses has nothing to
	 * reveal. Without this it would become a button that opens an empty card,
	 * which is worse than the inert marker it was.
	 */
	it('has nothing to reveal when its only link is one the renderer refuses', () => {
		expect(
			resolveHotspotPopoverContent({
				body: null,
				linkUrl: 'javascript:alert(1)'
			})
		).toBeNull()
	})
})

describe('resolveHotspotPopoverPlacement', () => {
	const bounds = { width: 800, height: 600 }
	const size = { width: 200, height: 100 }
	const place = (anchor: { x: number; y: number }, overrides = {}) =>
		resolveHotspotPopoverPlacement({
			anchor,
			size,
			bounds,
			gap: 20,
			margin: 8,
			...overrides
		})

	it('sits above a marker with room above it', () => {
		expect(place({ x: 400, y: 300 })).toEqual({ side: 'above', offsetX: 0 })
	})

	// The clipped-label defect, in the shape the popover would have inherited.
	it('flips below a marker near the top edge', () => {
		expect(place({ x: 400, y: 40 }).side).toBe('below')
	})

	it('goes back above once there is room for it again', () => {
		// 100 tall, 20 of gap and 8 of margin: 128 is the first y that fits.
		expect(place({ x: 400, y: 127 }).side).toBe('below')
		expect(place({ x: 400, y: 128 }).side).toBe('above')
	})

	it('shifts right off the left edge, by exactly what it takes', () => {
		// Centred would put the left edge at 20 - 100 = -80; the margin wants 8.
		expect(place({ x: 20, y: 300 }).offsetX).toBe(88)
	})

	it('shifts left off the right edge, by exactly what it takes', () => {
		// Centred would put the right edge at 780 + 100 = 880; the margin wants
		// it at 792.
		expect(place({ x: 780, y: 300 }).offsetX).toBe(-88)
	})

	it('leaves a marker that already fits alone', () => {
		expect(place({ x: 108, y: 300 }).offsetX).toBe(0)
		expect(place({ x: 692, y: 300 }).offsetX).toBe(0)
	})

	it('pins a card wider than the canvas to the left margin', () => {
		// The clamp that keeps the right edge on screen would otherwise push the
		// left edge off it, which is the worse of the two.
		const wide = resolveHotspotPopoverPlacement({
			anchor: { x: 400, y: 300 },
			size: { width: 900, height: 100 },
			bounds,
			gap: 20,
			margin: 8
		})

		expect(400 - 900 / 2 + wide.offsetX).toBe(8)
	})

	it('picks the roomier side when the card fits on neither', () => {
		const tall = { width: 200, height: 560 }
		const near = (y: number) =>
			resolveHotspotPopoverPlacement({
				anchor: { x: 400, y },
				size: tall,
				bounds,
				gap: 20,
				margin: 8
			}).side

		expect(near(500)).toBe('above')
		expect(near(100)).toBe('below')
	})
})
