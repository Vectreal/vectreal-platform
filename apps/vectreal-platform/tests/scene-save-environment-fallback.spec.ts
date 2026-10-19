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
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

const { warning, error } = vi.hoisted(() => ({
	warning: vi.fn(),
	error: vi.fn()
}))
vi.mock('sonner', () => ({ toast: { warning, error } }))

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function save({
	environmentFellBack,
	thumbnailUpload = 'ok',
	stored = false
}: {
	environmentFellBack?: boolean
	thumbnailUpload?: 'ok' | 'fails'
	/** The stored thumbnail is relinked, so nothing new is captured. */
	stored?: boolean
}) {
	let committed = false
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

	const meta = {
		name: 'Chair',
		description: '',
		thumbnailUrl: '/api/scenes/s1/thumbnail/thumb-old'
	}
	await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings: {},
		sceneMetaState: meta,
		lastSavedSceneMeta: stored ? meta : null,
		lastSavedSettings: {} as never,
		optimizationSettings: {},
		optimizationReport: null,
		createRequestId: () => 'req-1',
		prepareGltfDocumentForUpload: async () => ({
			data: { asset: { version: '2.0' } },
			assets: new Map()
		}),
		captureSceneThumbnail: async () => PNG_DATA_URL,
		environmentFellBack
	})
	return { committed }
}

describe('a save after the environment map fell back', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.clearAllMocks()
	})

	it('saves and warns that the preview carries the neutral room', async () => {
		const { committed } = await save({ environmentFellBack: true })

		expect(committed).toBe(true)
		expect(warning).toHaveBeenCalledTimes(1)
		expect(warning.mock.calls[0][0]).toMatch(/neutral room/)
	})

	it('says nothing when the map loaded', async () => {
		await save({ environmentFellBack: false })

		expect(warning).not.toHaveBeenCalled()
	})

	it('says nothing when the save relinks the stored preview', async () => {
		await save({ environmentFellBack: true, stored: true })

		expect(warning).not.toHaveBeenCalled()
	})

	it('says nothing when no new preview was stored', async () => {
		await save({ environmentFellBack: true, thumbnailUpload: 'fails' })

		expect(warning).not.toHaveBeenCalled()
		expect(error).toHaveBeenCalled()
	})
})
