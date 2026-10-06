import { readFileSync } from 'node:fs'

import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { buildTextureThumbnailUrls } from './scene-texture-thumbnails'

const url = (assetId: string) => `/assets/${assetId}`

describe('buildTextureThumbnailUrls', () => {
	it('gives every image asset a URL', () => {
		expect(
			buildTextureThumbnailUrls(
				[
					{ id: 'a', name: 'base.webp', mimeType: 'image/webp' },
					{ id: 'b', name: 'normal.png', mimeType: 'image/png' }
				],
				url
			)
		).toEqual({ a: '/assets/a', b: '/assets/b' })
	})

	it('leaves out buffers and assets of unknown type', () => {
		expect(
			buildTextureThumbnailUrls(
				[
					{ id: 'a', name: 'scene.bin', mimeType: 'application/octet-stream' },
					{ id: 'b', name: 'mystery', mimeType: null }
				],
				url
			)
		).toEqual({})
	})

	it("leaves out the scene's saved thumbnail, which is no texture", () => {
		expect(
			buildTextureThumbnailUrls(
				[{ id: 't', name: SCENE_THUMBNAIL_FILENAME, mimeType: 'image/webp' }],
				url
			)
		).toEqual({})
	})
})

describe('the scene page', () => {
	/*
	  Asserted on source because the cost is invisible to any test: React's
	  render logging only runs in a development browser, jsdom has no
	  Performance panel, and a unit test with a four-byte fixture would pass
	  either way. So the rule is stated directly: no component on this page
	  accepts the bytes, only the URLs built above.
	*/
	const source = (path: string) =>
		readFileSync(new URL(path, import.meta.url), 'utf8')

	it.each([
		'../../../routes/dashboard-page/projects/scene.tsx',
		'../../../components/dashboard/scene-detail/scene-aside.tsx',
		'../../../components/dashboard/scene-detail/scene-details-sheet.tsx',
		'../../../components/dashboard/scene-detail/scene-assets-section.tsx',
		'../../../components/dashboard/scene-asset-list-item.tsx'
	])('passes no asset bytes through props in %s', (path) => {
		expect(source(path)).not.toMatch(/assetData=\{/)
		expect(source(path)).not.toMatch(
			/assetData\?:\s*SerializedSceneAssetDataMap/
		)
	})
})
