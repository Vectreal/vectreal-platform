/**
 * The `/embed` document's inline manifest and its fallbacks, with the
 * database mocked out.
 *
 * Null tells the client to fetch the manifest itself, so every case where an
 * inline manifest would be wrong must come back null rather than as a
 * manifest: one built from a failed settings read renders the published model
 * with default lighting and no shadow, and one whose unsigned asset URLs need
 * a key the client never sends fails every asset request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../app/db/client', () => ({ getDbClient: () => ({}) }))

vi.mock('../app/lib/domain/auth/preview-api-key-auth.server', () => ({
	validatePreviewApiKeyForProject: vi.fn(async () => ({
		ok: true,
		organizationId: 'org-1',
		apiKeyId: 'key-1'
	}))
}))

vi.mock('../app/lib/domain/billing/entitlement-service.server', () => ({
	hasEntitlement: vi.fn(async () => false)
}))

vi.mock(
	'../app/lib/domain/scene/server/scene-preview-repository.server',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		getPublishedScenePreview: vi.fn()
	})
)

vi.mock('../app/lib/domain/scene/server/scene-settings-service.server', () => ({
	sceneSettingsService: {
		getSceneSettingsWithAssetRefs: vi.fn(),
		getSceneMetadata: vi.fn(async () => null)
	}
}))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))

import { getPublishedScenePreview } from '../app/lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../app/lib/domain/scene/server/scene-settings-service.server'
import { reportServerError } from '../app/lib/observability/report-server-error.server'
import { loader } from '../app/routes/layouts/embed-layout'

import type { Route } from '../app/routes/layouts/+types/embed-layout'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const SCENE_ID = '22222222-2222-4222-8222-222222222222'

const loadEmbed = async (query: string, init?: RequestInit) => {
	const response = await loader({
		request: new Request(
			`https://vectreal.test/embed/${PROJECT_ID}/${SCENE_ID}${query}`,
			init
		),
		params: { projectId: PROJECT_ID, sceneId: SCENE_ID }
	} as unknown as Route.LoaderArgs)
	return (response as unknown as { data: { manifest: unknown } }).data
		.manifest as { publishedModel: { url: string } } | null
}

beforeEach(() => {
	vi.mocked(getPublishedScenePreview).mockResolvedValue({
		publishedAssetId: 'glb-1',
		publishedAt: new Date('2026-10-01T00:00:00Z'),
		publishedAssetName: 'scene.glb',
		publishedAssetMimeType: 'model/gltf-binary',
		publishedAssetSizeBytes: 3,
		publishedAssetMetadata: null
	} as never)
	vi.mocked(
		sceneSettingsService.getSceneSettingsWithAssetRefs
	).mockResolvedValue({
		meta: null,
		settings: null,
		settingsUpdatedAt: null,
		assets: [],
		sourceAsset: null,
		gltfJson: null
	} as never)
})

afterEach(() => {
	vi.clearAllMocks()
	vi.unstubAllEnvs()
})

describe('the inline embed manifest', () => {
	it('is left to the client when the settings cannot be read', async () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', 'secret')
		vi.mocked(
			sceneSettingsService.getSceneSettingsWithAssetRefs
		).mockRejectedValue(new Error('connection reset'))

		expect(await loadEmbed('?token=vctrl_key')).toBeNull()
		expect(reportServerError).toHaveBeenCalledOnce()
	})

	it('is left to the client when unsigned URLs would need a header-only key', async () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', '')

		const manifest = await loadEmbed('', {
			headers: { authorization: 'Bearer vctrl_key' }
		})

		expect(manifest).toBeNull()
	})

	it('carries the query key in unsigned asset URLs', async () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', '')

		const manifest = await loadEmbed('?token=vctrl_key')

		expect(manifest?.publishedModel.url).toContain('token=vctrl_key')
	})

	it('signs its asset URLs when a secret is set', async () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', 'secret')

		const manifest = await loadEmbed('?token=vctrl_key')

		expect(manifest?.publishedModel.url).toMatch(/\?exp=\d+&sig=/)
		expect(manifest?.publishedModel.url).not.toContain('token=')
	})
})
