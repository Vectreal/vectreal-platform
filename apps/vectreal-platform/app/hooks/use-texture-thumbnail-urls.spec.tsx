// @vitest-environment jsdom
/**
 * Thumbnail URLs for a scene's images, made where the bytes live.
 *
 * The defect this replaces was not in what the thumbnails looked like. The scene
 * page passed every asset's raw bytes through four components' props, and
 * React's development render logging walked each changed prop down to every
 * byte - a 40-second freeze on a scene with 27 MB of textures. The first half of
 * this file is the hook; the second pins that no component on that page takes
 * the bytes again, which is the invariant the freeze came from.
 */

import { readFileSync } from 'node:fs'

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTextureThumbnailUrls } from './use-texture-thumbnail-urls'

import type { SerializedSceneAssetDataMap } from '../types/api'

const PNG: SerializedSceneAssetDataMap = {
	'tex-1': {
		data: new Uint8Array([137, 80, 78, 71]),
		fileName: 'normal.png',
		mimeType: 'image/png'
	},
	'bin-1': {
		data: new Uint8Array([1, 2, 3]),
		fileName: 'scene.bin',
		mimeType: 'application/octet-stream'
	}
}

let created: string[]
let revoked: string[]

beforeEach(() => {
	created = []
	revoked = []
	/* jsdom implements neither; the real ones are what production calls. */
	URL.createObjectURL = vi.fn(() => {
		const url = `blob:test/${created.length}`
		created.push(url)
		return url
	})
	URL.revokeObjectURL = vi.fn((url: string) => {
		revoked.push(url)
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('useTextureThumbnailUrls', () => {
	it('makes a URL for each image and nothing else', () => {
		/*
		  The model's binary buffer is not a picture. An object URL for it would
		  be a handle on megabytes nobody displays.
		*/
		const { result } = renderHook(() => useTextureThumbnailUrls(PNG))

		expect(Object.keys(result.current)).toEqual(['tex-1'])
		expect(result.current['tex-1']).toMatch(/^blob:/)
	})

	it('releases every URL it made when the page goes away', () => {
		/*
		  An object URL keeps its bytes alive until revoked. Leaking one per
		  texture per visit holds tens of megabytes for the life of the tab.
		*/
		const { unmount } = renderHook(() => useTextureThumbnailUrls(PNG))
		const made = [...created]

		unmount()

		expect(made.length).toBeGreaterThan(0)
		expect(revoked).toEqual(expect.arrayContaining(made))
	})

	it('releases the old set when the scene data changes', () => {
		const { rerender } = renderHook(
			({ data }) => useTextureThumbnailUrls(data),
			{ initialProps: { data: PNG } }
		)
		const first = [...created]

		rerender({ data: { ...PNG } })

		expect(revoked).toEqual(expect.arrayContaining(first))
	})

	it('never hands back a URL it has already revoked, under StrictMode', () => {
		/*
		  StrictMode runs an effect's cleanup between its two setups in
		  development. A version that made the URLs in a memo and revoked them in
		  an effect passes every test above - and under StrictMode returns URLs its
		  own first cleanup already revoked, which renders as broken images.
		*/
		const { result } = renderHook(() => useTextureThumbnailUrls(PNG), {
			reactStrictMode: true
		})

		const inUse = Object.values(result.current)
		expect(inUse.length).toBeGreaterThan(0)
		for (const url of inUse) {
			expect(revoked).not.toContain(url)
		}
	})

	it('returns nothing before the scene has loaded', () => {
		const { result } = renderHook(() => useTextureThumbnailUrls(undefined))

		expect(result.current).toEqual({})
		expect(created).toEqual([])
	})
})

describe('the scene page', () => {
	/*
	  Asserted on source because the cost is invisible to any test: React's
	  render logging only runs in a development browser, jsdom has no
	  Performance panel, and a unit test with a four-byte fixture would pass
	  either way. So the rule is stated directly - no component on this page
	  accepts the bytes - and the one sanctioned owner of them is the hook above.
	*/
	const source = (path: string) =>
		readFileSync(new URL(path, import.meta.url), 'utf8')

	it.each([
		'../routes/dashboard-page/projects/scene.tsx',
		'../components/dashboard/scene-detail/scene-aside.tsx',
		'../components/dashboard/scene-detail/scene-details-sheet.tsx',
		'../components/dashboard/scene-detail/scene-assets-section.tsx',
		'../components/dashboard/scene-asset-list-item.tsx'
	])('passes no asset bytes through props in %s', (path) => {
		expect(source(path)).not.toMatch(/assetData=\{/)
		expect(source(path)).not.toMatch(
			/assetData\?:\s*SerializedSceneAssetDataMap/
		)
	})
})
