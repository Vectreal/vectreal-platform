/**
 * Whether a save relinks the scene's stored thumbnail or takes a new one.
 *
 * Model files are reused only when `prepare-scene-upload` lists them in
 * `existingAssets`, and a save into another project lists nothing, because
 * every asset has to land in the new project's storage. The thumbnail used to
 * skip that rule: it was relinked from the publisher's own state, so a move
 * linked an asset in the old project and the server refused the whole save.
 *
 * This drives the real `executeSceneSaveOrchestrator` against a stubbed API.
 */
import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const STORED_URL = '/api/scenes/s1/thumbnail/thumb-old'

interface Committed {
	sceneAssetIds: string[]
	thumbnailUrl: string
	captures: number
}

async function save(
	existingAssets: Record<string, { assetId: string; contentHash: string }>
): Promise<Committed> {
	let sceneAssetIds: string[] = []
	let thumbnailUrl = ''

	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({ sceneId: 's1', projectId: 'p2', existingAssets })
		}
		if (action === 'upload-scene-asset') return ok({ assetId: 'thumb-new' })
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		sceneAssetIds = JSON.parse(String(form.get('sceneAssetIds')))
		thumbnailUrl = JSON.parse(String(form.get('meta'))).thumbnailUrl
		return ok({ sceneId: 's1' })
	})

	const captureSceneThumbnail = vi.fn(async () => PNG_DATA_URL)
	const meta = { name: 'Chair', description: '', thumbnailUrl: STORED_URL }

	await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings: {},
		sceneMetaState: meta,
		lastSavedSceneMeta: meta,
		lastSavedSettings: {} as never,
		optimizationSettings: {},
		optimizationReport: null,
		createRequestId: () => 'req-1',
		prepareGltfDocumentForUpload: async () => ({
			data: { asset: { version: '2.0' } },
			assets: new Map()
		}),
		captureSceneThumbnail,
		options: { targetProjectId: 'p2' }
	})

	return {
		sceneAssetIds,
		thumbnailUrl,
		captures: captureSceneThumbnail.mock.calls.length
	}
}

describe('the stored thumbnail on a save', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('is relinked when the server lists it as reusable', async () => {
		const committed = await save({
			[SCENE_THUMBNAIL_FILENAME]: { assetId: 'thumb-old', contentHash: 'h' }
		})

		expect(committed.captures).toBe(0)
		expect(committed.thumbnailUrl).toBe(STORED_URL)
		expect(committed.sceneAssetIds).toContain('thumb-old')
	})

	it('is replaced by a fresh capture on a save into another project', async () => {
		const committed = await save({})

		expect(committed.captures).toBe(1)
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
		expect(committed.sceneAssetIds).toContain('thumb-new')
		expect(committed.sceneAssetIds).not.toContain('thumb-old')
	})
})
