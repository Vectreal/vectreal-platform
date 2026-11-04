import { describe, expect, it } from 'vitest'

import { toViewerLoadingThumbnail } from './viewer-loading-thumbnail'

describe('toViewerLoadingThumbnail', () => {
	it('asks the viewer to contain the 16:9 thumbnail rather than crop it', () => {
		expect(toViewerLoadingThumbnail(' /thumb.webp ')).toEqual({
			src: '/thumb.webp',
			alt: 'Scene loading thumbnail',
			objectFit: 'contain'
		})
	})

	it('gives no backdrop for a scene without a thumbnail', () => {
		expect(toViewerLoadingThumbnail(null)).toBeUndefined()
		expect(toViewerLoadingThumbnail('   ')).toBeUndefined()
	})
})
