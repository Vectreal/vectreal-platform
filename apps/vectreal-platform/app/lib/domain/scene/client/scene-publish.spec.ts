import { afterEach, describe, expect, it, vi } from 'vitest'

import { publishSceneFromGlb } from './scene-publish'

const mocks = vi.hoisted(() => ({ postFormWithProgress: vi.fn() }))

vi.mock('./post-form-with-progress', () => ({
	postFormWithProgress: mocks.postFormWithProgress
}))

const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		headers: { 'Content-Type': 'application/json' }
	})

describe('publishSceneFromGlb', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.clearAllMocks()
	})

	// The size is what the server stored, never the buffer this browser sent.
	it('reports the published size the server recorded', async () => {
		mocks.postFormWithProgress.mockResolvedValue(
			json({ success: true, data: { assetId: 'a1' } })
		)
		const fetchSpy = vi.fn().mockResolvedValueOnce(
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
		const commit = fetchSpy.mock.calls[0][1].body as FormData
		expect(commit.has('currentSceneBytes')).toBe(false)
	})

	it('reports the upload as it goes, then the commit', async () => {
		const events: string[] = []
		mocks.postFormWithProgress.mockImplementation(
			async (
				_url: string,
				_body: FormData,
				onProgress: (f: number) => void
			) => {
				onProgress(0.25)
				onProgress(1)
				return json({ success: true, data: { assetId: 'a1' } })
			}
		)
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				events.push('commit request')
				return json({ success: true, data: { sceneId: 's1' } })
			})
		)

		await publishSceneFromGlb({
			sceneId: 's1',
			baseFileName: 'scene',
			glbData: new Uint8Array(7),
			onUploadProgress: (fraction) => events.push(`upload ${fraction}`),
			onCommitting: () => events.push('committing')
		})

		expect(events).toEqual([
			'upload 0.25',
			'upload 1',
			'committing',
			'commit request'
		])
	})
})
