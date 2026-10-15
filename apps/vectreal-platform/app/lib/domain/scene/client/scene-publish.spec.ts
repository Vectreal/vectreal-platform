import { afterEach, describe, expect, it, vi } from 'vitest'

import { publishSceneFromGlb } from './scene-publish'

const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		headers: { 'Content-Type': 'application/json' }
	})

describe('publishSceneFromGlb', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	// The size is what the server stored, never the buffer this browser sent.
	it('reports the published size the server recorded', async () => {
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(json({ success: true, data: { assetId: 'a1' } }))
			.mockResolvedValueOnce(
				json({
					success: true,
					data: { sceneId: 's1', stats: { currentSceneBytes: 42 } }
				})
			)
		vi.stubGlobal('fetch', fetchSpy)

		const { publishState } = await publishSceneFromGlb({
			sceneId: 's1',
			baseFileName: 'scene',
			glbData: new Uint8Array(7)
		})

		expect(publishState.publishedAssetSizeBytes).toBe(42)
		const commit = fetchSpy.mock.calls[1][1].body as FormData
		expect(commit.has('currentSceneBytes')).toBe(false)
	})
})
