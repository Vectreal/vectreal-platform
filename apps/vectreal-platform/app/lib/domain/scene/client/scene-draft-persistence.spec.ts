import { describe, expect, it, vi } from 'vitest'

const savePendingSceneDraft =
	vi.fn<(args: { sceneData: Record<string, unknown> }) => Promise<string>>()

vi.mock('../../../persistence/pending-scene-idb', () => ({
	savePendingSceneDraft: (args: { sceneData: Record<string, unknown> }) =>
		savePendingSceneDraft(args)
}))

vi.mock('./scene-draft-serialization', () => ({
	serializeSceneAssetData: async () => ({})
}))

import { persistPendingSceneDraftOrchestrator } from './scene-draft-persistence'

import type { SceneSettings } from '@vctrl/core'

const hotspot = {
	id: '11111111-1111-4111-8111-111111111111',
	name: 'Handle',
	worldPosition: [1, 2, 3] as [number, number, number],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot' as const
}

const currentSettings = {
	bounds: { margin: 1 },
	environment: { preset: 'city' },
	camera: { cameras: [] },
	controls: { enabled: true },
	shadows: { enabled: false },
	normalization: { enabled: true, minSize: 0.5, maxSize: 5 },
	interactions: { scrollProgress: { enabled: true } },
	presentation: { showInfoPopover: false },
	hotspots: [hotspot],
	// Not part of `SceneSettings`, and deliberately present: the payload spreads
	// this object wholesale, so spread order is the only thing keeping a stale
	// settings blob from clobbering the draft's own meta and document.
	meta: { name: 'stale', description: 'stale', thumbnailUrl: 'stale' },
	gltfJson: 'stale',
	assetData: 'stale'
} as unknown as SceneSettings

const persist = () =>
	persistPendingSceneDraftOrchestrator({
		modelAvailable: true,
		prepareGltfDocumentForUpload: async () => ({ data: { asset: {} } }),
		sceneMetaState: { name: 'Scene', description: '', thumbnailUrl: '' },
		currentSettings,
		optimizationSettings: null
	})

const persistedSettings = async () => {
	savePendingSceneDraft.mockClear()
	savePendingSceneDraft.mockResolvedValue('draft-1')
	await persist()
	const call = savePendingSceneDraft.mock.calls[0]
	if (!call) throw new Error('savePendingSceneDraft was never called')
	return call[0]
}

describe('persistPendingSceneDraftOrchestrator', () => {
	it('persists the hotspots the caller composed', async () => {
		const { sceneData } = await persistedSettings()

		expect(sceneData.hotspots).toEqual([hotspot])
	})

	it('persists interactions and normalization alongside them', async () => {
		const { sceneData } = await persistedSettings()

		expect(sceneData.interactions).toEqual(currentSettings.interactions)
		expect(sceneData.normalization).toEqual(currentSettings.normalization)
	})

	it('persists the author’s info-popover choice', async () => {
		// An author who switches the popover off and is sent to sign in gets
		// that choice back, rather than a scene silently reverted to the default.
		const { sceneData } = await persistedSettings()

		expect(sceneData.presentation).toEqual({ showInfoPopover: false })
	})

	it('keeps carrying the settings the literal used to list by hand', async () => {
		const { sceneData } = await persistedSettings()

		expect(sceneData.bounds).toEqual(currentSettings.bounds)
		expect(sceneData.environment).toEqual(currentSettings.environment)
		expect(sceneData.camera).toEqual(currentSettings.camera)
		expect(sceneData.controls).toEqual(currentSettings.controls)
		expect(sceneData.shadows).toEqual(currentSettings.shadows)
	})

	it('lets the draft meta win over anything the settings carry', async () => {
		const { sceneData } = await persistedSettings()

		expect(sceneData.meta).toEqual({
			name: 'Scene',
			description: '',
			thumbnailUrl: ''
		})
	})

	it('lets the draft document win too', async () => {
		const { sceneData } = await persistedSettings()

		expect(sceneData.gltfJson).not.toBe('stale')
		expect(sceneData.assetData).not.toBe('stale')
	})
})
