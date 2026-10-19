import { describe, expect, it, vi } from 'vitest'

import {
	applyHotspotArtworkRewrites,
	persistHotspotArtwork
} from './hotspot-artwork-save'
import { buildHotspotArtworkUrl } from '../hotspot-artwork'
import { MAX_HOTSPOT_URL_LENGTH } from '../hotspot-urls'

import type { HotspotDefinition } from '@vctrl/core'

const SCENE_ID = '33333333-3333-4333-8333-333333333333'
const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'
const STORED_ID = '22222222-2222-4222-8222-222222222222'
const UPLOADED_ID = '55555555-5555-4555-8555-555555555555'

const OTHER_ID = '66666666-6666-4666-8666-666666666666'
const THIRD_ID = '77777777-7777-4777-8777-777777777777'

const marker = (payloadUrl?: string, id = HOTSPOT_ID): HotspotDefinition =>
	({
		id,
		name: ' Rear badge ',
		worldPosition: [0, 0, 0],
		visible: true,
		internalOnly: false,
		stylePreset: 'image',
		payloadUrl
	}) as HotspotDefinition

/** A base64 PNG data URL too long to stay inline. */
const largeImage = (type = 'image/png') =>
	`data:${type};base64,${btoa('x'.repeat(MAX_HOTSPOT_URL_LENGTH))}`

const run = (
	hotspots: HotspotDefinition[],
	overrides: Partial<Parameters<typeof persistHotspotArtwork>[0]> = {}
) => {
	const upload = vi.fn(async (_file: File) => UPLOADED_ID)
	const readStored = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))
	return {
		upload,
		readStored,
		result: persistHotspotArtwork({
			hotspots,
			sceneId: SCENE_ID,
			existingAssets: {},
			upload,
			readStored,
			...overrides
		})
	}
}

describe('persistHotspotArtwork', () => {
	it('uploads an image too large to stay inline and points the marker at it', async () => {
		const { upload, result } = run([marker(largeImage())])
		const { hotspots, assetIds } = await result

		const file = upload.mock.calls[0][0]
		expect(file.name).toBe(`hotspot-artwork-${HOTSPOT_ID}.png`)
		expect(file.type).toBe('image/png')
		expect(hotspots?.[0].payloadUrl).toBe(
			buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID)
		)
		expect(assetIds).toEqual([UPLOADED_ID])
	})

	it.each([
		['a small inline image', 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'],
		['a linked image saved before uploads', 'https://cdn.test/pin.png'],
		['no image', undefined]
	])('leaves %s alone', async (_label, payloadUrl) => {
		const { upload, result } = run([marker(payloadUrl)])
		const { hotspots, assetIds } = await result

		expect(upload).not.toHaveBeenCalled()
		expect(hotspots?.[0].payloadUrl).toBe(payloadUrl)
		expect(assetIds).toEqual([])
	})

	it('relinks artwork the scene still holds without uploading it again', async () => {
		const url = buildHotspotArtworkUrl(SCENE_ID, STORED_ID)
		const { upload, readStored, result } = run([marker(url)], {
			existingAssets: {
				[`hotspot-artwork-${HOTSPOT_ID}.png`]: {
					assetId: STORED_ID,
					contentHash: 'hash'
				}
			}
		})
		const { hotspots, assetIds } = await result

		expect(upload).not.toHaveBeenCalled()
		expect(readStored).not.toHaveBeenCalled()
		expect(hotspots?.[0].payloadUrl).toBe(url)
		expect(assetIds).toEqual([STORED_ID])
	})

	it('uploads stored artwork again when the save reuses nothing', async () => {
		// A scene saved into another project starts with no existing assets.
		const url = buildHotspotArtworkUrl(SCENE_ID, STORED_ID)
		const { upload, readStored, result } = run([marker(url)])
		const { hotspots, assetIds } = await result

		expect(readStored).toHaveBeenCalledWith(url)
		expect(upload).toHaveBeenCalledOnce()
		expect(hotspots?.[0].payloadUrl).toBe(
			buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID)
		)
		expect(assetIds).toEqual([UPLOADED_ID])
	})

	it('stops the save, naming the marker, when stored artwork cannot be read', async () => {
		const url = buildHotspotArtworkUrl(SCENE_ID, STORED_ID)
		const { upload, result } = run([marker(url)], {
			readStored: async () => null
		})

		await expect(result).rejects.toThrow(
			'marker "Rear badge" could not be read'
		)
		expect(upload).not.toHaveBeenCalled()
	})

	it('stops the save when a large inline image cannot be decoded', async () => {
		const { result } = run([
			marker(`data:image/png;base64,${'%'.repeat(MAX_HOTSPOT_URL_LENGTH)}`)
		])

		await expect(result).rejects.toThrow('could not be read')
	})

	it('carries on past an uploaded marker, keeping every marker in order', async () => {
		const inline = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'
		const stored = buildHotspotArtworkUrl(SCENE_ID, STORED_ID)
		const large = largeImage()
		const { result } = run(
			[marker(large), marker(inline, OTHER_ID), marker(stored, THIRD_ID)],
			{
				existingAssets: {
					[`hotspot-artwork-${THIRD_ID}.png`]: {
						assetId: STORED_ID,
						contentHash: 'hash'
					}
				}
			}
		)
		const { hotspots, assetIds, rewrites } = await result

		expect(
			hotspots?.map((hotspot) => [hotspot.id, hotspot.payloadUrl])
		).toEqual([
			[HOTSPOT_ID, buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID)],
			[OTHER_ID, inline],
			[THIRD_ID, stored]
		])
		expect(assetIds).toEqual([UPLOADED_ID, STORED_ID])
		expect(rewrites).toEqual([
			{
				hotspotId: HOTSPOT_ID,
				from: large,
				to: buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID)
			}
		])
	})

	it.each([
		['image/svg+xml', 'svg'],
		['image/gif', 'gif']
	])('uploads a large %s under its own extension', async (type, ext) => {
		const { upload, result } = run([marker(largeImage(type))])
		await result

		expect(upload.mock.calls[0][0].name).toBe(
			`hotspot-artwork-${HOTSPOT_ID}.${ext}`
		)
	})

	it('stops the save, naming the marker, for a large inline file that is no marker image', async () => {
		// The picker never stores one; a hand-edited draft could.
		const { upload, result } = run([marker(largeImage('image/bmp'))])

		await expect(result).rejects.toThrow(
			'marker "Rear badge" is not a PNG, JPEG, WebP, GIF or SVG'
		)
		expect(upload).not.toHaveBeenCalled()
	})
})

describe('applyHotspotArtworkRewrites', () => {
	const to = buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID)
	const rewrites = [{ hotspotId: HOTSPOT_ID, from: 'data:a', to }]

	it('moves a marker still holding the saved image to its new address', () => {
		expect(
			applyHotspotArtworkRewrites([marker('data:a')], rewrites)[0].payloadUrl
		).toBe(to)
	})

	it('leaves an image picked while the save ran, and other markers, alone', () => {
		const result = applyHotspotArtworkRewrites(
			[marker('data:b'), marker('data:a', OTHER_ID)],
			rewrites
		)

		expect(result.map((hotspot) => hotspot.payloadUrl)).toEqual([
			'data:b',
			'data:a'
		])
	})
})
