/**
 * A save keeps the studio finish the preview drew for exactly what it saves,
 * so the draft's own surfaces show it, and otherwise leaves the stored one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'
import { STUDIO_FINISH_FILENAME } from '../app/lib/domain/scene/scene-asset-roles'

import type { StudioFinishToSave } from '../app/lib/domain/scene/studio-finish'

const reports = { occlusion: { baked: ['body'], skipped: [] } }
const finish: StudioFinishToSave = {
	bytes: new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer,
	reports
}

async function save(
	captureStudioFinish:
		| ((lighting: unknown) => Promise<StudioFinishToSave | undefined>)
		| undefined,
	existingAssets: Record<string, { assetId: string; contentHash: string }> = {}
) {
	const uploaded: string[] = []
	let commit: FormData | null = null
	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({ sceneId: 's1', projectId: 'p1', existingAssets })
		}
		if (action === 'upload-scene-asset') {
			uploaded.push((form.get('file') as File).name)
			return ok({ assetId: 'finish-new' })
		}
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		commit = form
		return ok({ sceneId: 's1' })
	})

	await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings: {},
		sceneMetaState: { name: 'Chair' } as never,
		lastSavedSceneMeta: { name: 'Chair' } as never,
		lastSavedSettings: {} as never,
		optimizationSettings: {},
		optimizationReport: null,
		createRequestId: () => 'req-1',
		prepareGltfDocumentForUpload: async () => ({
			data: { asset: { version: '2.0' } },
			assets: new Map()
		}),
		captureSceneThumbnail: async () => null,
		captureStudioFinish
	})

	const sent = commit!.get('studioFinish')
	return {
		uploaded,
		studioFinish: sent === null ? 'omitted' : JSON.parse(String(sent))
	}
}

describe('a saved studio finish', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('uploads the finish the preview drew and links it with its reports', async () => {
		const { uploaded, studioFinish } = await save(async () => finish)

		expect(uploaded).toEqual([STUDIO_FINISH_FILENAME])
		expect(studioFinish).toEqual({
			assetId: 'finish-new',
			reports,
			unencoded: true
		})
	})

	it('reuses the stored finish when its bytes are the ones saved', async () => {
		const hash = Array.from(
			new Uint8Array(await crypto.subtle.digest('SHA-256', finish.bytes))
		)
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('')

		const { uploaded, studioFinish } = await save(async () => finish, {
			[STUDIO_FINISH_FILENAME]: { assetId: 'finish-old', contentHash: hash }
		})

		expect(uploaded).toEqual([])
		expect(studioFinish).toEqual({
			assetId: 'finish-old',
			reports,
			unencoded: true
		})
	})

	it('reads the finish when the save starts, not after its uploads', async () => {
		const reads: string[] = []
		stubSceneApi(async (form) => {
			reads.push(String(form.get('action')))
			return ok({ sceneId: 's1', projectId: 'p1', existingAssets: {} })
		})
		await executeSceneSaveOrchestrator({
			userId: 'u1',
			currentSceneId: 's1',
			currentSettings: {},
			sceneMetaState: { name: 'Chair' } as never,
			lastSavedSceneMeta: { name: 'Chair' } as never,
			lastSavedSettings: {} as never,
			optimizationSettings: {},
			optimizationReport: null,
			createRequestId: () => 'req-1',
			prepareGltfDocumentForUpload: async () => ({
				data: { asset: { version: '2.0' } },
				assets: new Map()
			}),
			captureSceneThumbnail: async () => null,
			captureStudioFinish: async () => {
				reads.push('capture')
				return undefined
			}
		}).catch(() => {})

		expect(reads[0]).toBe('capture')
	})

	// A pass started while a save waits on a bake must not reach the upload
	// with the settings and report captured before it.
	it('asks for the finish drawn for the lighting it saves, once the model is exported', async () => {
		stubSceneApi(async () =>
			ok({ sceneId: 's1', projectId: 'p1', existingAssets: {} })
		)
		const lighting = { occlusion: { mode: 'baked' as const } }
		const captureStudioFinish = vi.fn(async () => undefined)
		const prepareGltfDocumentForUpload = vi.fn(async () => ({
			data: { asset: { version: '2.0' } },
			assets: new Map()
		}))
		await executeSceneSaveOrchestrator({
			userId: 'u1',
			currentSceneId: 's1',
			currentSettings: { lighting },
			sceneMetaState: { name: 'Chair' } as never,
			lastSavedSceneMeta: { name: 'Chair' } as never,
			lastSavedSettings: {} as never,
			optimizationSettings: {},
			optimizationReport: null,
			createRequestId: () => 'req-1',
			prepareGltfDocumentForUpload,
			captureSceneThumbnail: async () => null,
			captureStudioFinish
		}).catch(() => {})

		expect(captureStudioFinish).toHaveBeenCalledWith(lighting)
		expect(
			prepareGltfDocumentForUpload.mock.invocationCallOrder[0]
		).toBeLessThan(captureStudioFinish.mock.invocationCallOrder[0])
	})

	it('leaves the stored finish alone when there is none to send', async () => {
		expect((await save(async () => undefined)).studioFinish).toBe('omitted')
		expect((await save(undefined)).studioFinish).toBe('omitted')
	})
})
