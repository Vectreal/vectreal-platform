import { describe, expect, it } from 'vitest'

import {
	buildHotspotArtworkUrl,
	canUploadHotspotArtwork,
	findNewRemoteArtwork,
	HOTSPOT_INLINE_ARTWORK_MAX_KB,
	hotspotArtworkAssetIdFromUrl,
	hotspotArtworkFileName,
	isHotspotArtworkAsset,
	isHotspotArtworkPath,
	isHotspotPayloadUrlShape
} from './hotspot-artwork'
import { isAllowedHotspotPayloadUrl } from './hotspot-urls'

const SCENE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SCENE_ID = '44444444-4444-4444-8444-444444444444'
const ASSET_ID = '55555555-5555-4555-8555-555555555555'
const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_HOTSPOT_ID = '66666666-6666-4666-8666-666666666666'

describe('hotspot artwork', () => {
	it('round-trips the path it builds', () => {
		const url = buildHotspotArtworkUrl(SCENE_ID, ASSET_ID)

		expect(isHotspotArtworkPath(url)).toBe(true)
		expect(hotspotArtworkAssetIdFromUrl(SCENE_ID, url)).toBe(ASSET_ID)
	})

	it.each([
		['another scene', buildHotspotArtworkUrl(OTHER_SCENE_ID, ASSET_ID)],
		['a query string', `${buildHotspotArtworkUrl(SCENE_ID, ASSET_ID)}?x=1`],
		['a trailing segment', `${buildHotspotArtworkUrl(SCENE_ID, ASSET_ID)}/x`],
		['a non-uuid id', buildHotspotArtworkUrl(SCENE_ID, 'not-a-uuid')],
		[
			'an absolute URL',
			`https://evil.test${buildHotspotArtworkUrl(SCENE_ID, ASSET_ID)}`
		],
		['an inline image', 'data:image/png;base64,AAAA'],
		['a remote URL', 'https://cdn.test/pin.png'],
		['nothing', undefined]
	])('names no asset of this scene for %s', (_label, value) => {
		expect(hotspotArtworkAssetIdFromUrl(SCENE_ID, value)).toBeNull()
	})

	it('reads only the shape of a path, for any scene', () => {
		// The parser admits the shape before it knows the save's linked assets.
		expect(
			isHotspotArtworkPath(buildHotspotArtworkUrl(OTHER_SCENE_ID, ASSET_ID))
		).toBe(true)
		expect(isHotspotArtworkPath(buildHotspotArtworkUrl(SCENE_ID, 'nope'))).toBe(
			false
		)
	})

	it('names the file by the marker and the image type', () => {
		expect(hotspotArtworkFileName(HOTSPOT_ID, 'image/webp')).toBe(
			`hotspot-artwork-${HOTSPOT_ID}.webp`
		)
		expect(hotspotArtworkFileName(HOTSPOT_ID, 'IMAGE/JPEG')).toBe(
			`hotspot-artwork-${HOTSPOT_ID}.jpg`
		)
	})

	it('recognizes an artwork row by its reserved name and an image type', () => {
		const name = hotspotArtworkFileName(HOTSPOT_ID, 'image/png')

		expect(isHotspotArtworkAsset({ name, mimeType: 'image/png' })).toBe(true)
		// A texture is never artwork, whatever its type.
		expect(
			isHotspotArtworkAsset({
				name: 'Shoe_baseColor.webp',
				mimeType: 'image/webp'
			})
		).toBe(false)
		// Nor is a reserved name that is not an image.
		expect(isHotspotArtworkAsset({ name, mimeType: 'model/gltf-binary' })).toBe(
			false
		)
		expect(isHotspotArtworkAsset({ name, mimeType: null })).toBe(false)
	})

	it('never reads a texture whose own name starts with the prefix as artwork', () => {
		// Texture names come from the author's file. Read as artwork, it would be
		// left out of the model and the scene would fail to load.
		expect(
			isHotspotArtworkAsset({
				name: 'hotspot-artwork-logo.png',
				mimeType: 'image/png'
			})
		).toBe(false)
	})

	it('refuses an artwork path whose ids are not lowercase', () => {
		// Postgres returns lowercase ids, so an uppercase path would pass the
		// parser and then never match the linked row the embed compares it to.
		const upper = buildHotspotArtworkUrl(
			SCENE_ID,
			'abcdef01-2345-4678-89ab-cdef01234567'.toUpperCase()
		)

		expect(isHotspotArtworkPath(upper)).toBe(false)
		expect(hotspotArtworkAssetIdFromUrl(SCENE_ID, upper)).toBeNull()
	})

	it('admits inline images, https and artwork paths as payload shapes, and nothing else', () => {
		expect(isHotspotPayloadUrlShape('data:image/png;base64,AAAA')).toBe(true)
		expect(isHotspotPayloadUrlShape('https://cdn.test/pin.png')).toBe(true)
		expect(
			isHotspotPayloadUrlShape(buildHotspotArtworkUrl(SCENE_ID, ASSET_ID))
		).toBe(true)
		expect(isHotspotPayloadUrlShape('http://cdn.test/pin.png')).toBe(false)
		expect(isHotspotPayloadUrlShape('/api/scenes/x/assets/y')).toBe(false)
	})

	it.each(['image/tiff', 'image/svg+xml', 'image/gif'])(
		'refuses to name uploaded artwork of %s, which the asset route will not serve as an image',
		(type) => {
			expect(canUploadHotspotArtwork(type)).toBe(false)
			expect(() => hotspotArtworkFileName(HOTSPOT_ID, type)).toThrow()
		}
	)
})

describe('findNewRemoteArtwork', () => {
	const stored = [{ id: HOTSPOT_ID, payloadUrl: 'https://cdn.test/pin.png' }]
	const marker = (payloadUrl?: string, id = HOTSPOT_ID) => ({
		id,
		name: 'Rear badge',
		payloadUrl
	})

	it('lets a linked image already stored on that marker through', () => {
		expect(
			findNewRemoteArtwork([marker('https://cdn.test/pin.png')], stored)
		).toBeNull()
	})

	it.each([
		['an edited address', marker('https://cdn.test/other.png')],
		['a new marker', marker('https://cdn.test/pin.png', OTHER_HOTSPOT_ID)],
		['a different case of scheme', marker('HTTPS://cdn.test/new.png')]
	])('names the marker carrying %s', (_label, hotspot) => {
		expect(findNewRemoteArtwork([hotspot], stored)).toEqual({
			name: 'Rear badge'
		})
	})

	it.each([
		['an inline image', 'data:image/png;base64,AAAA'],
		['uploaded artwork', buildHotspotArtworkUrl(SCENE_ID, ASSET_ID)],
		['no image', undefined]
	])('lets %s through', (_label, payloadUrl) => {
		expect(findNewRemoteArtwork([marker(payloadUrl)], [])).toBeNull()
	})
})

describe('HOTSPOT_INLINE_ARTWORK_MAX_KB', () => {
	// The figure both refusals quote: an SVG of that size must stay inline,
	// and one KB more must not, or the message points at the wrong limit.
	const svgOf = (kb: number) =>
		`data:image/svg+xml;base64,${btoa('x'.repeat(kb * 1024))}`

	it('is the largest whole KB that stays inline', () => {
		expect(
			isAllowedHotspotPayloadUrl(svgOf(HOTSPOT_INLINE_ARTWORK_MAX_KB))
		).toBe(true)
		expect(
			isAllowedHotspotPayloadUrl(svgOf(HOTSPOT_INLINE_ARTWORK_MAX_KB + 1))
		).toBe(false)
	})
})
