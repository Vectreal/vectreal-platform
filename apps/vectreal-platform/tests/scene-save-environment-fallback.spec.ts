/**
 * A save after the environment map failed warns that the preview it stores is
 * lit by the viewer's neutral room.
 *
 * The save is allowed: the Environment panel already says the map failed, and
 * the author may want the scene stored anyway. What the panel cannot show is
 * that the thumbnail, the image the dashboard and the loading screen use, now
 * carries that room's light. This drives the real
 * `executeSceneSaveOrchestrator` against a stubbed API.
 */
import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { buildThumbnailFrameSignature } from '../app/lib/domain/scene/client/scene-change-detection'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

const { warning, error } = vi.hoisted(() => ({
	warning: vi.fn(),
	error: vi.fn()
}))
vi.mock('sonner', () => ({ toast: { warning, error } }))

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const STORED_URL = '/api/scenes/s1/thumbnail/thumb-old'

async function save({
	fallback,
	thumbnailUpload = 'ok',
	stored = false,
	pending,
	captureFails = false
}: {
	/** The fallback state, asked when the save asks; a function to change it. */
	fallback: boolean | ((captured: boolean) => boolean)
	thumbnailUpload?: 'ok' | 'fails'
	/** The stored thumbnail is relinked, so nothing new is captured. */
	stored?: boolean
	/** A waiting capture, and whether it painted the current frame. */
	pending?: 'current' | 'stale'
	captureFails?: boolean
}) {
	let committed = false
	let captured = false
	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({
				sceneId: 's1',
				projectId: 'p1',
				existingAssets: stored
					? {
							[SCENE_THUMBNAIL_FILENAME]: {
								assetId: 'thumb-old',
								contentHash: 'h'
							}
						}
					: {}
			})
		}
		if (action === 'upload-scene-asset') {
			if (thumbnailUpload === 'fails') throw new Error('upload refused')
			return ok({ assetId: 'thumb-new' })
		}
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		committed = true
		return ok({ sceneId: 's1' })
	})

	const meta = { name: 'Chair', description: '', thumbnailUrl: STORED_URL }
	const current = { environment: { preset: 'studio-key' } } as never
	const frame = buildThumbnailFrameSignature(current)
	await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings: current,
		sceneMetaState: pending ? { ...meta, thumbnailUrl: PNG_DATA_URL } : meta,
		capturedThumbnailFrame: pending
			? {
					thumbnailUrl: PNG_DATA_URL,
					frame: pending === 'current' ? frame : 'an-earlier-frame'
				}
			: undefined,
		lastSavedSceneMeta: stored ? meta : null,
		lastSavedSettings: stored ? current : ({} as never),
		optimizationSettings: {},
		optimizationReport: null,
		createRequestId: () => 'req-1',
		prepareGltfDocumentForUpload: async () => ({
			data: { asset: { version: '2.0' } },
			assets: new Map()
		}),
		captureSceneThumbnail: async () => {
			captured = true
			return captureFails ? null : PNG_DATA_URL
		},
		isEnvironmentFallback: () =>
			typeof fallback === 'function' ? fallback(captured) : fallback
	})
	return { committed }
}

describe('a save after the environment map fell back', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.clearAllMocks()
	})

	it('saves and warns that a fresh preview carries the neutral room', async () => {
		const { committed } = await save({ fallback: true })

		expect(committed).toBe(true)
		expect(warning).toHaveBeenCalledTimes(1)
		expect(warning.mock.calls[0][0]).toMatch(/neutral room/)
	})

	it('warns when the map fails after the save began, before the capture', async () => {
		await save({ fallback: (captured) => captured })

		expect(warning).toHaveBeenCalledTimes(1)
	})

	it('warns for a waiting capture of the current frame', async () => {
		await save({ fallback: true, pending: 'current' })

		expect(warning).toHaveBeenCalledTimes(1)
	})

	it('says nothing for an earlier capture standing in for a failed one', async () => {
		await save({ fallback: true, pending: 'stale', captureFails: true })

		expect(warning).not.toHaveBeenCalled()
	})

	it('says nothing when the map loaded', async () => {
		await save({ fallback: false })

		expect(warning).not.toHaveBeenCalled()
	})

	it('says nothing when the save relinks the stored preview', async () => {
		await save({ fallback: true, stored: true })

		expect(warning).not.toHaveBeenCalled()
	})

	it('says nothing when no new preview was stored', async () => {
		await save({ fallback: true, thumbnailUpload: 'fails' })

		expect(warning).not.toHaveBeenCalled()
		expect(error).toHaveBeenCalled()
	})
})
