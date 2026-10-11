/**
 * A save stores the shadow bake with the model measurements it was baked on.
 *
 * Embeds validate the bake against that basis, because the model they load
 * is the Draco-compressed GLB and cannot reproduce the editor model's vertex
 * count. A save that dropped it would leave every embed re-baking again.
 */
import { PERSISTED_BAKE_FILENAME } from '@vctrl/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

import type { SceneSettings } from '@vctrl/core'

const basis = { footprint: 1.2, radius: 0.9, vertexCount: 18_432 }
const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** What `prepare-scene-upload` lists for a same-project save that links `bake-old`. */
const LISTS_OLD_BAKE = {
	[PERSISTED_BAKE_FILENAME]: { assetId: 'bake-old', contentHash: 'h-bake' }
}

async function savedShadows(
	currentSettings: SceneSettings,
	bake: { dataUrl: string | null; signature: string },
	existingAssets: Record<string, { assetId: string; contentHash: string }> = {}
): Promise<{ shadows: SceneSettings['shadows']; sceneAssetIds: string[] }> {
	let committed: SceneSettings | null = null
	let sceneAssetIds: string[] = []

	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({ sceneId: 's1', projectId: 'p1', existingAssets })
		}
		if (action === 'upload-scene-asset') return ok({ assetId: 'bake-new' })
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		committed = JSON.parse(String(form.get('settings')))
		sceneAssetIds = JSON.parse(String(form.get('sceneAssetIds')))
		return ok({ sceneId: 's1' })
	})

	await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings,
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
		captureShadowBake: async () => ({ ...bake, basis })
	})

	return { shadows: committed!.shadows, sceneAssetIds }
}

describe('a saved shadow bake', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('carries the basis of a freshly captured bake', async () => {
		const { shadows } = await savedShadows(
			{ shadows: { enabled: true } },
			{ dataUrl: PNG_DATA_URL, signature: 'sig-new' }
		)

		expect(shadows?.baked).toEqual({
			assetId: 'bake-new',
			signature: 'sig-new',
			basis
		})
	})

	const storedBake: SceneSettings = {
		shadows: {
			enabled: true,
			baked: { assetId: 'bake-old', signature: 'sig-old' }
		}
	}

	it('gains a basis when a bake saved before them is kept', async () => {
		const { shadows, sceneAssetIds } = await savedShadows(
			storedBake,
			{ dataUrl: null, signature: 'sig-old' },
			LISTS_OLD_BAKE
		)

		expect(shadows?.baked).toEqual({
			assetId: 'bake-old',
			signature: 'sig-old',
			basis
		})
		expect(sceneAssetIds).toContain('bake-old')
	})

	/*
	  A save into another project gets nothing back as reusable. The stored bake
	  lives in the old project, so relinking it made the server refuse the whole
	  save. With no fresh bytes to upload, the ref is dropped and the scene
	  re-bakes on its next load.
	*/
	it('is dropped, not relinked, when the server does not list it', async () => {
		const { shadows, sceneAssetIds } = await savedShadows(storedBake, {
			dataUrl: null,
			signature: 'sig-old'
		})

		expect(shadows?.baked).toBeUndefined()
		expect(sceneAssetIds).not.toContain('bake-old')
	})
})
