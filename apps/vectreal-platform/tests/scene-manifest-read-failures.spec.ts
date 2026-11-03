/**
 * A working manifest whose model could not be read fails, rather than
 * answering 200 with no model in it.
 *
 * Staging, 3 Nov 2026: Supabase Storage refused the glTF download, the read
 * reported it and answered `gltfJson: null`, and the publisher told the user
 * the scene had no model data. The scene was intact. The degraded body also
 * carried the ETag a good body gets, so a browser revalidating
 * `/api/scenes/:id` would have kept it until the next save.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transaction, downloadAsset, downloadAssets, readRow } = vi.hoisted(
	() => ({
		transaction: vi.fn(),
		downloadAsset: vi.fn(),
		downloadAssets: vi.fn(),
		readRow: vi.fn()
	})
)

vi.mock('../app/db/client', () => ({
	getDbClient: () => ({ transaction })
}))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))

vi.mock('../app/lib/domain/asset/asset-storage.server', async (original) => ({
	...(await original<object>()),
	downloadAsset,
	downloadAssets
}))

vi.mock(
	'../app/lib/domain/scene/server/scene-settings-repository.server',
	async (original) => ({
		...(await original<object>()),
		getSceneSettingsWithAssetsRow: readRow,
		getHotspotsBySceneSettingsId: vi.fn(async () => []),
		rowToSceneSettings: vi.fn(() => ({}))
	})
)

import { buildSceneManifest } from '../app/lib/domain/scene/server/scene-manifest.server'
import { sceneSettingsService } from '../app/lib/domain/scene/server/scene-settings-service.server'
import { getSceneSettings } from '../app/lib/domain/scene/server/scene-settings.operations.server'

const gltfAsset = {
	id: 'gltf-1',
	name: 'scene.gltf',
	mimeType: 'model/gltf+json',
	fileSize: 10
}

let row: {
	settings: { id: string; updatedAt: Date }
	assets: (typeof gltfAsset)[]
	sourceAsset: null
}

const buildUrl = (assetId: string) => `/api/scenes/scene-1/assets/${assetId}`

beforeEach(() => {
	row = {
		settings: { id: 'settings-1', updatedAt: new Date('2026-11-03T20:49:13Z') },
		assets: [gltfAsset],
		sourceAsset: null
	}
	readRow.mockImplementation(async () => row)
	transaction.mockReset()
	transaction.mockImplementation(async (run: (tx: object) => unknown) =>
		run({})
	)
	downloadAsset.mockReset()
	downloadAssets.mockReset()
	vi.spyOn(sceneSettingsService, 'getSceneMetadata').mockResolvedValue(null)
	vi.spyOn(sceneSettingsService, 'getSceneStats').mockResolvedValue(null)
})

describe('a linked glTF document that cannot be read', () => {
	it('fails the settings read, keeping the storage error as its cause', async () => {
		const storageError = new Error(
			'Failed to inspect storage bucket: Too many connections issued to the database'
		)
		downloadAsset.mockRejectedValue(storageError)

		const read = sceneSettingsService.getSceneSettingsWithAssetRefs('scene-1')

		await expect(read).rejects.toThrow(
			'Failed to read the glTF document of scene scene-1'
		)
		await expect(read).rejects.toHaveProperty('cause', storageError)
	})

	it('fails the settings read when the stored bytes are not JSON', async () => {
		downloadAsset.mockResolvedValue({
			data: new TextEncoder().encode('<html>gateway timeout</html>'),
			mimeType: 'model/gltf+json',
			fileName: 'scene.gltf'
		})

		await expect(
			sceneSettingsService.getSceneSettingsWithAssetRefs('scene-1')
		).rejects.toThrow('Failed to read the glTF document of scene scene-1')
	})

	it('fails the working manifest instead of serving it without a model', async () => {
		downloadAsset.mockRejectedValue(new Error('Internal Server Error'))

		await expect(buildSceneManifest('scene-1', buildUrl)).rejects.toThrow(
			'Failed to read the glTF document of scene scene-1'
		)
	})
})

describe('the working manifest', () => {
	it('fails when the settings read fails', async () => {
		transaction.mockRejectedValue(new Error('connection reset'))

		await expect(buildSceneManifest('scene-1', buildUrl)).rejects.toThrow(
			'connection reset'
		)
	})

	it('carries the document it read', async () => {
		downloadAsset.mockResolvedValue({
			data: new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
			mimeType: 'model/gltf+json',
			fileName: 'scene.gltf'
		})

		const manifest = await buildSceneManifest('scene-1', buildUrl)

		expect(manifest.gltfJson).toEqual({ asset: { version: '2.0' } })
		expect(manifest.settingsUpdatedAt).toBe('2026-11-03T20:49:13.000Z')
	})

	it('still answers for a scene with no glTF document linked', async () => {
		row.assets = []

		const manifest = await buildSceneManifest('scene-1', buildUrl)

		expect(manifest.gltfJson).toBeNull()
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it('degrades meta and stats to null when only they fail', async () => {
		downloadAsset.mockResolvedValue({
			data: new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
			mimeType: 'model/gltf+json',
			fileName: 'scene.gltf'
		})
		vi.spyOn(sceneSettingsService, 'getSceneStats').mockRejectedValue(
			new Error('stats unavailable')
		)

		const manifest = await buildSceneManifest('scene-1', buildUrl)

		expect(manifest.stats).toBeNull()
		expect(manifest.gltfJson).not.toBeNull()
	})
})

/**
 * The client falls back to the legacy `get-scene-settings` POST whenever the
 * manifest is not ok, so that read has to fail the same way or the outage
 * reaches the user as "no model data" one request later.
 */
describe('the legacy scene settings read', () => {
	const documentBytes = {
		data: new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
		mimeType: 'model/gltf+json',
		fileName: 'scene.gltf'
	}

	it('fails when the settings read fails', async () => {
		transaction.mockRejectedValue(new Error('connection reset'))

		await expect(
			sceneSettingsService.getSceneSettingsWithAssets('scene-1')
		).rejects.toThrow('connection reset')
	})

	it('fails when the glTF document did not download', async () => {
		// `downloadAssets` drops a failed download from its map.
		downloadAssets.mockResolvedValue(new Map())

		await expect(
			sceneSettingsService.getSceneSettingsWithAssets('scene-1')
		).rejects.toThrow('Failed to read the glTF document of scene scene-1')
	})

	it('still renders a scene short of a texture', async () => {
		const texture = {
			id: 'tex-1',
			name: 'base.webp',
			mimeType: 'image/webp',
			fileSize: 10
		}
		row.assets = [gltfAsset, texture]
		downloadAssets.mockResolvedValue(new Map([[gltfAsset.id, documentBytes]]))

		const result =
			await sceneSettingsService.getSceneSettingsWithAssets('scene-1')

		expect(result?.gltfJson).toEqual({ asset: { version: '2.0' } })
		expect(result?.assetDataMap?.has(texture.id)).toBe(false)
	})
})

describe('the legacy scene settings response to a failed read', () => {
	it('answers 500 without echoing the driver message', async () => {
		vi.spyOn(sceneSettingsService, 'getProjectIdFromScene').mockResolvedValue(
			'project-1'
		)
		transaction.mockRejectedValue(
			new Error('Failed query: select "scene_settings"."id" from ...')
		)

		const response = await getSceneSettings({
			action: 'get-scene-settings',
			sceneId: 'scene-1'
		} as never)

		expect(response.status).toBe(500)
		const body = await response.text()
		expect(body).toContain('Failed to get scene settings')
		expect(body).not.toContain('Failed query')
	})
})
