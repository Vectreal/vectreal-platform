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
