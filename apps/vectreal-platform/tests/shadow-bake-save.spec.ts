/**
 * A save stores the shadow bake with the model measurements it was baked on.
 *
 * Embeds validate the bake against that basis, because the model they load
 * is the Draco-compressed GLB and cannot reproduce the editor model's vertex
 * count. A save that dropped it would leave every embed re-baking again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

import type { SceneSettings } from '@vctrl/core'

const basis = { footprint: 1.2, radius: 0.9, vertexCount: 18_432 }
const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function savedShadows(
	currentSettings: SceneSettings,
	bake: { dataUrl: string | null; signature: string }
): Promise<SceneSettings['shadows']> {
	let committed: SceneSettings | null = null

	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({ sceneId: 's1', projectId: 'p1', existingAssets: {} })
		}
		if (action === 'upload-scene-asset') return ok({ assetId: 'bake-new' })
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		committed = JSON.parse(String(form.get('settings')))
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

	return committed!.shadows
}

describe('a saved shadow bake', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('carries the basis of a freshly captured bake', async () => {
		const shadows = await savedShadows(
			{ shadows: { enabled: true } },
			{ dataUrl: PNG_DATA_URL, signature: 'sig-new' }
		)

		expect(shadows?.baked).toEqual({
			assetId: 'bake-new',
			signature: 'sig-new',
			basis
		})
	})

	it('gains a basis when a bake saved before them is kept', async () => {
		const shadows = await savedShadows(
			{
				shadows: {
					enabled: true,
					baked: { assetId: 'bake-old', signature: 'sig-old' }
				}
			},
			{ dataUrl: null, signature: 'sig-old' }
		)

		expect(shadows?.baked).toEqual({
			assetId: 'bake-old',
			signature: 'sig-old',
			basis
		})
	})
})
