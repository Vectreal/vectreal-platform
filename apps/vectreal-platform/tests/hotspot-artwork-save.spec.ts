/**
 * A save turns a marker's picked image into a scene asset and links it.
 *
 * The link is what keeps the upload alive: an artwork asset the commit does
 * not list is refused by the parser and collected by the GC, and the embed
 * policy serves only what the scene links. So the wiring, not only
 * `persistHotspotArtwork`, is what this pins.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'
import { buildHotspotArtworkUrl } from '../app/lib/domain/scene/hotspot-artwork'
import { MAX_HOTSPOT_URL_LENGTH } from '../app/lib/domain/scene/hotspot-urls'

import type { HotspotDefinition, SceneSettings } from '@vctrl/core'

const SCENE_ID = '33333333-3333-4333-8333-333333333333'
const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'
const UPLOADED_ID = '55555555-5555-4555-8555-555555555555'
const STORED_ID = '22222222-2222-4222-8222-222222222222'

const marker = (payloadUrl: string): HotspotDefinition => ({
	id: HOTSPOT_ID,
	name: 'Rear badge',
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'image',
	payloadUrl
})

async function save(
	payloadUrl: string,
	existingAssets: Record<string, { assetId: string; contentHash: string }> = {},
	stored: Response | null = null
) {
	let committed: SceneSettings | null = null
	let sceneAssetIds: string[] = []
	const uploadedNames: string[] = []
	const uploadForms: FormData[] = []

	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({ sceneId: SCENE_ID, projectId: 'p1', existingAssets })
		}
		if (action === 'upload-scene-asset') {
			uploadedNames.push((form.get('file') as File).name)
			uploadForms.push(form)
			return ok({ assetId: UPLOADED_ID })
		}
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		committed = JSON.parse(String(form.get('settings')))
		sceneAssetIds = JSON.parse(String(form.get('sceneAssetIds')))
		return ok({ sceneId: SCENE_ID })
	})
	// The stored copy is read with a plain GET, which the scene API stub does
	// not answer: route it to the bytes the test holds.
	const sceneApi = globalThis.fetch
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string, init?: RequestInit) =>
			init
				? sceneApi(url, init)
				: Promise.resolve(stored ?? new Response(null, { status: 404 }))
		)
	)

	const result = await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: SCENE_ID,
		currentSettings: { hotspots: [marker(payloadUrl)] },
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
		options: { targetProjectId: 'p2' }
	})

	return {
		payloadUrl: committed!.hotspots?.[0].payloadUrl,
		sceneAssetIds,
		uploadedNames,
		uploadForms,
		rewrites: result.hotspotArtworkRewrites
	}
}

describe('marker artwork on save', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('uploads a large picked image and commits the marker pointing at it, linked', async () => {
		const large = `data:image/png;base64,${btoa('x'.repeat(MAX_HOTSPOT_URL_LENGTH))}`

		const { payloadUrl, sceneAssetIds, uploadedNames, rewrites } =
			await save(large)

		expect(uploadedNames).toEqual([`hotspot-artwork-${HOTSPOT_ID}.png`])
		expect(payloadUrl).toBe(buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID))
		expect(sceneAssetIds).toContain(UPLOADED_ID)
		// Handed back, so the editor moves to the address too.
		expect(rewrites).toEqual([
			{
				hotspotId: HOTSPOT_ID,
				from: large,
				to: buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID)
			}
		])
	})

	it('keeps artwork the scene already holds linked across a resave', async () => {
		const url = buildHotspotArtworkUrl(SCENE_ID, STORED_ID)

		const { payloadUrl, sceneAssetIds, uploadedNames } = await save(url, {
			[`hotspot-artwork-${HOTSPOT_ID}.png`]: {
				assetId: STORED_ID,
				contentHash: 'h-art'
			}
		})

		expect(uploadedNames).toEqual([])
		expect(payloadUrl).toBe(url)
		expect(sceneAssetIds).toContain(STORED_ID)
	})

	it('uploads stored artwork again on a save that reuses nothing, into the target project', async () => {
		// A move to another project lists no existing assets, so the stored
		// copy is read and uploaded where the scene is going.
		const { payloadUrl, sceneAssetIds, uploadedNames, uploadForms } =
			await save(
				buildHotspotArtworkUrl(SCENE_ID, STORED_ID),
				{},
				new Response(new Blob(['png'], { type: 'image/png' }))
			)

		expect(uploadedNames).toEqual([`hotspot-artwork-${HOTSPOT_ID}.png`])
		const form = uploadForms[0]
		expect({
			kind: form.get('kind'),
			sceneId: form.get('sceneId'),
			targetProjectId: form.get('targetProjectId')
		}).toEqual({ kind: 'image', sceneId: SCENE_ID, targetProjectId: 'p2' })
		expect(payloadUrl).toBe(buildHotspotArtworkUrl(SCENE_ID, UPLOADED_ID))
		expect(sceneAssetIds).toContain(UPLOADED_ID)
	})

	it('stops the save when the stored copy cannot be read', async () => {
		await expect(
			save(buildHotspotArtworkUrl(SCENE_ID, STORED_ID))
		).rejects.toThrow('could not be read')
	})
})
