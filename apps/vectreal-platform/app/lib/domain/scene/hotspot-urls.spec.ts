import { describe, expect, it } from 'vitest'

import {
	isAllowedHotspotPayloadUrl,
	MAX_HOTSPOT_URL_LENGTH
} from './hotspot-urls'

describe('isAllowedHotspotPayloadUrl', () => {
	it.each([
		['an https URL', 'https://cdn.example.com/pin.png'],
		['an inline png', 'data:image/png;base64,AAAA'],
		['an inline svg', 'data:image/svg+xml;base64,AAAA'],
		['an inline svg with no parameter', 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'],
		['an uppercase scheme', 'HTTPS://cdn.example.com/pin.png'],
		['a mixed-case data media type', 'data:IMAGE/PNG;base64,AAAA']
	])('accepts %s', (_label, value) => {
		expect(isAllowedHotspotPayloadUrl(value)).toBe(true)
	})

	it.each([
		['a script URL', 'javascript:alert(1)'],
		['plain http, which fails silently as mixed content', 'http://x.test/a.png'],
		['an inline document', 'data:text/html;base64,AAAA'],
		['a bare data prefix', 'data:'],
		['a scheme with no host', 'https://'],
		['a relative path', '/assets/pin.png'],
		['empty', '']
	])('rejects %s', (_label, value) => {
		expect(isAllowedHotspotPayloadUrl(value)).toBe(false)
	})

	it('rejects a data URI past the length ceiling', () => {
		const oversized = `data:image/png;base64,${'A'.repeat(MAX_HOTSPOT_URL_LENGTH)}`

		expect(isAllowedHotspotPayloadUrl(oversized)).toBe(false)
	})

	it('applies the same ceiling to an https URL', () => {
		// `payload_url` is an unbounded text column either way, so a ceiling that
		// only covered data URIs would leave the column unbounded again.
		const oversized = `https://x.test/${'a'.repeat(MAX_HOTSPOT_URL_LENGTH)}`

		expect(isAllowedHotspotPayloadUrl(oversized)).toBe(false)
	})

	it('accepts a value at exactly the ceiling', () => {
		const prefix = 'https://x.test/'
		const exact = prefix + 'a'.repeat(MAX_HOTSPOT_URL_LENGTH - prefix.length)

		expect(exact).toHaveLength(MAX_HOTSPOT_URL_LENGTH)
		expect(isAllowedHotspotPayloadUrl(exact)).toBe(true)
	})

	it('rejects a media type that merely starts with an allowed one', () => {
		expect(isAllowedHotspotPayloadUrl('data:image/pngx,AAAA')).toBe(false)
	})
})
