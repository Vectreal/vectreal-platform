import { describe, expect, it } from 'vitest'

import {
	buildHotspotArtworkUrl,
	hotspotArtworkAssetIdFromUrl,
	hotspotArtworkFileName,
	isHotspotArtworkAsset,
	isHotspotArtworkPath,
	isHotspotPayloadUrlShape
} from './hotspot-artwork'

const SCENE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SCENE_ID = '44444444-4444-4444-8444-444444444444'
const ASSET_ID = '55555555-5555-4555-8555-555555555555'
const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'

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
		expect(hotspotArtworkFileName(HOTSPOT_ID, 'image/svg+xml')).toBe(
			`hotspot-artwork-${HOTSPOT_ID}.svg`
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

	it('refuses to name artwork of a type a marker cannot draw', () => {
		expect(() => hotspotArtworkFileName(HOTSPOT_ID, 'image/tiff')).toThrow()
	})
})
