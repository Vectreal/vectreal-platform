/**
 * The asset route's caching and authorization, with storage and the database
 * mocked out.
 *
 * A signed request is answered with no key lookup and is cached at the edge,
 * so the route must refuse every request the signature does not cover, re-check
 * that the asset is still one an embed gets, and keep every other response
 * private: a public response on the key or session path would let the edge
 * serve one caller's asset to another.
 */
import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The `scene_assets` rows the link check reads; empty means unlinked. */
const linkedRows: unknown[] = []

vi.mock('../app/db/client', () => {
	const query = {
		select: () => query,
		from: () => query,
		innerJoin: () => query,
		where: () => query,
		limit: async () => linkedRows
	}
	return { getDbClient: () => query }
})

vi.mock('../app/lib/domain/asset/asset-storage.server', () => {
	class AssetNotFoundError extends Error {}
	return {
		AssetNotFoundError,
		downloadAsset: vi.fn(),
		downloadAssetFromRow: vi.fn()
	}
})

vi.mock('../app/lib/domain/auth/preview-api-key-auth.server', () => ({
	validatePreviewApiKeyForProject: vi.fn()
}))

vi.mock(
	'../app/lib/domain/scene/server/scene-preview-repository.server',
	() => ({
		getPublishedScenePreview: vi.fn(),
		getPublishedSceneById: vi.fn()
	})
)

vi.mock('../app/lib/domain/dashboard/dashboard-permissions.server', () => ({
	resolveSceneMembership: vi.fn()
}))

vi.mock('../app/lib/domain/scene/server/scene-settings-service.server', () => ({
	sceneSettingsService: { getSceneSettingsWithAssetRefs: vi.fn() }
}))

vi.mock('../app/lib/http/auth.server', () => ({ getAuthUser: vi.fn() }))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))

import {
	AssetNotFoundError,
	downloadAsset,
	downloadAssetFromRow
} from '../app/lib/domain/asset/asset-storage.server'
import { validatePreviewApiKeyForProject } from '../app/lib/domain/auth/preview-api-key-auth.server'
import { resolveSceneMembership } from '../app/lib/domain/dashboard/dashboard-permissions.server'
import { SIDE_ASSET_MAX_AGE_SECONDS } from '../app/lib/domain/embed/embed-asset-serving.server'
import {
	buildSignedAssetUrl,
	signedAssetExpiry
} from '../app/lib/domain/embed/embed-asset-signature.server'
import {
	getPublishedSceneById,
	getPublishedScenePreview
} from '../app/lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../app/lib/domain/scene/server/scene-settings-service.server'
import { getAuthUser } from '../app/lib/http/auth.server'
import { reportServerError } from '../app/lib/observability/report-server-error.server'
import { loader } from '../app/routes/api/scenes.$sceneId.assets.$assetId'

import type { LoaderFunctionArgs } from 'react-router'

const SECRET = 'route-test-secret'
// Real uuids: the route answers 404 to a malformed scene or asset id before
// any branch.
const SCENE_ID = '0b9c2a64-6d5f-4c1e-9a7b-3f2e1d0c9b8a'
const GLB_ID = '1a2b3c4d-0000-4000-8000-000000000001'
const PUBLISHED_ROW = {
	publishedAssetId: GLB_ID,
	publishedAssetFilePath: 'project/scene.glb',
	publishedAssetName: 'scene.glb',
	publishedAssetMimeType: 'model/gltf-binary'
}
const ORIGIN = 'https://vectreal.test'

const get = (path: string, method = 'GET') =>
	loader({
		request: new Request(`${ORIGIN}${path}`, { method }),
		params: { sceneId: SCENE_ID, assetId: GLB_ID }
	} as unknown as LoaderFunctionArgs)

const signedPath = (assetId = GLB_ID) =>
	buildSignedAssetUrl({ sceneId: SCENE_ID, assetId }, SECRET, Date.now())

const signedGet = (assetId: string) =>
	loader({
		request: new Request(`${ORIGIN}${signedPath(assetId)}`),
		params: { sceneId: SCENE_ID, assetId }
	} as unknown as LoaderFunctionArgs)

const maxAgeOf = (response: Response) => {
	const match = response.headers
		.get('Cache-Control')
		?.match(/^public, max-age=(\d+), s-maxage=(\d+)$/)
	expect(match, 'a signed response is public and sets both ages').toBeTruthy()
	expect(match![1]).toBe(match![2])
	return Number(match![1])
}

const glbBytes = {
	data: new Uint8Array([1, 2, 3]),
	mimeType: 'model/gltf-binary',
	fileName: 'scene.glb'
}

beforeEach(() => {
	vi.mocked(downloadAsset).mockResolvedValue(glbBytes)
	vi.mocked(downloadAssetFromRow).mockResolvedValue(glbBytes)
})

afterEach(() => {
	vi.clearAllMocks()
	vi.unstubAllEnvs()
	linkedRows.length = 0
})

describe('a signed asset request', () => {
	const THUMBNAIL_ID = '1a2b3c4d-0000-4000-8000-000000000002'

	/** The scene's live settings, as the servable check reads them. */
	const liveSettings = (showLoadingThumbnail: boolean) =>
		vi
			.mocked(sceneSettingsService.getSceneSettingsWithAssetRefs)
			.mockResolvedValue({
				assets: [
					{
						id: THUMBNAIL_ID,
						name: SCENE_THUMBNAIL_FILENAME,
						mimeType: 'image/webp',
						fileSize: 1
					}
				],
				settings: { presentation: { showLoadingThumbnail } }
			} as never)

	const downloadedNothing = () => {
		expect(downloadAsset).not.toHaveBeenCalled()
		expect(downloadAssetFromRow).not.toHaveBeenCalled()
	}

	beforeEach(() => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', SECRET)
		vi.mocked(getPublishedSceneById).mockResolvedValue(PUBLISHED_ROW as never)
		liveSettings(true)
	})

	it("serves the published GLB, public for exactly the URL's remaining life", async () => {
		const now = Date.UTC(2026, 9, 12, 10, 17, 30)
		vi.useFakeTimers({ now, toFake: ['Date'] })
		try {
			const response = await get(signedPath())

			expect(response.status).toBe(200)
			expect(maxAgeOf(response)).toBe(
				signedAssetExpiry(now) - Math.floor(now / 1000)
			)
		} finally {
			vi.useRealTimers()
		}
		expect(getPublishedSceneById).toHaveBeenCalledWith(SCENE_ID)
		expect(downloadAsset).toHaveBeenCalledWith(GLB_ID)
		expect(
			sceneSettingsService.getSceneSettingsWithAssetRefs
		).not.toHaveBeenCalled()
	})

	it('serves a shown loading thumbnail, held at the edge for minutes only', async () => {
		const response = await signedGet(THUMBNAIL_ID)

		expect(response.status).toBe(200)
		expect(maxAgeOf(response)).toBe(SIDE_ASSET_MAX_AGE_SECONDS)
		expect(downloadAsset).toHaveBeenCalledWith(THUMBNAIL_ID)
	})

	it('never holds a side asset at the edge past its URL', async () => {
		const issuedAt = Date.UTC(2026, 9, 12, 10, 0, 0)
		vi.useFakeTimers({ now: issuedAt, toFake: ['Date'] })
		try {
			const path = signedPath(THUMBNAIL_ID)
			const expiry = signedAssetExpiry(issuedAt)
			vi.setSystemTime((expiry - 100) * 1000)

			const response = await loader({
				request: new Request(`${ORIGIN}${path}`),
				params: { sceneId: SCENE_ID, assetId: THUMBNAIL_ID }
			} as unknown as LoaderFunctionArgs)

			expect(response.status).toBe(200)
			expect(maxAgeOf(response)).toBe(100)
		} finally {
			vi.useRealTimers()
		}
	})

	it('refuses the thumbnail once its author switches it off', async () => {
		liveSettings(false)

		const response = await signedGet(THUMBNAIL_ID)

		expect(response.status).toBe(404)
		downloadedNothing()
	})

	it('refuses every asset of a scene that is no longer published', async () => {
		vi.mocked(getPublishedSceneById).mockResolvedValue(null)

		for (const assetId of [GLB_ID, THUMBNAIL_ID]) {
			const response = await signedGet(assetId)
			expect(response.status).toBe(404)
		}
		downloadedNothing()
	})

	it('refuses the GLB a republish replaced, quietly and without a download', async () => {
		vi.mocked(getPublishedSceneById).mockResolvedValue({
			...PUBLISHED_ROW,
			publishedAssetId: '1a2b3c4d-0000-4000-8000-000000000003'
		} as never)

		const response = await get(signedPath())

		expect(response.status).toBe(404)
		downloadedNothing()
		expect(reportServerError).not.toHaveBeenCalled()
	})

	it('is refused, looking nothing up, without a signing secret', async () => {
		const path = signedPath()
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', '')

		const response = await get(path)

		expect(response.status).toBe(404)
		expect(getPublishedSceneById).not.toHaveBeenCalled()
		downloadedNothing()
	})

	it('is refused, looking nothing up, with a tampered signature', async () => {
		const signed = signedPath()
		const tampered = signed.replace(
			/sig=(.)/,
			(_, first: string) => `sig=${first === 'A' ? 'B' : 'A'}`
		)
		expect(tampered).not.toBe(signed)

		const response = await get(tampered)

		expect(response.status).toBe(404)
		expect(getPublishedSceneById).not.toHaveBeenCalled()
		downloadedNothing()
	})

	it('is refused at any other spelling of its path', async () => {
		const [path, query] = signedPath().split('?')

		const response = await get(`${path}/?${query}`)

		expect(response.status).toBe(404)
		downloadedNothing()
	})

	it('is refused for any method but GET, downloading nothing', async () => {
		const response = await get(signedPath(), 'HEAD')

		expect(response.status).toBe(405)
		downloadedNothing()
	})

	it('answers a row deleted between lookup and download with a quiet 404', async () => {
		for (const assetId of [GLB_ID, THUMBNAIL_ID]) {
			vi.mocked(downloadAsset).mockRejectedValueOnce(
				new AssetNotFoundError(assetId)
			)

			const response = await signedGet(assetId)

			expect(response.status, assetId).toBe(404)
		}
		expect(reportServerError).not.toHaveBeenCalled()
	})

	it('reports any other failure', async () => {
		vi.mocked(downloadAsset).mockRejectedValue(new Error('storage down'))

		const response = await get(signedPath())

		expect(response.status).toBe(500)
		expect(reportServerError).toHaveBeenCalledOnce()
	})
})

describe('a key-authenticated asset request', () => {
	beforeEach(() => {
		vi.mocked(validatePreviewApiKeyForProject).mockResolvedValue({
			ok: true
		} as never)
		vi.mocked(getPublishedScenePreview).mockResolvedValue(
			PUBLISHED_ROW as never
		)
	})

	it('stays private, even when its query merely contains "sig="', async () => {
		for (const query of [
			'preview=1&projectId=p&token=vctrl_key',
			'preview=1&projectId=p&token=vctrl_key&xsig=1'
		]) {
			const response = await get(
				`/api/scenes/${SCENE_ID}/assets/${GLB_ID}?${query}`
			)

			expect(response.status).toBe(200)
			expect(response.headers.get('Cache-Control')).toMatch(/^private,/)
		}
	})
	it("serves the published GLB from the publication's row, reading no settings", async () => {
		const response = await get(
			`/api/scenes/${SCENE_ID}/assets/${GLB_ID}?preview=1&projectId=p&token=vctrl_key`
		)

		expect(response.status).toBe(200)
		expect(downloadAssetFromRow).toHaveBeenCalledWith(
			expect.objectContaining({ id: GLB_ID, filePath: 'project/scene.glb' })
		)
		expect(downloadAsset).not.toHaveBeenCalled()
		expect(
			sceneSettingsService.getSceneSettingsWithAssetRefs
		).not.toHaveBeenCalled()
	})

	describe('for an asset other than the published GLB', () => {
		const BAKE_ID = '1a2b3c4d-0000-4000-8000-000000000004'
		const DRAFT_ID = '1a2b3c4d-0000-4000-8000-000000000005'
		const keyedGet = (assetId: string) =>
			loader({
				request: new Request(
					`${ORIGIN}/api/scenes/${SCENE_ID}/assets/${assetId}?preview=1&projectId=p&token=vctrl_key`
				),
				params: { sceneId: SCENE_ID, assetId }
			} as unknown as LoaderFunctionArgs)

		beforeEach(() => {
			vi.mocked(
				sceneSettingsService.getSceneSettingsWithAssetRefs
			).mockResolvedValue({
				assets: [
					{
						id: BAKE_ID,
						name: PERSISTED_BAKE_FILENAME,
						mimeType: 'image/png',
						fileSize: 1
					},
					{
						id: DRAFT_ID,
						name: 'draft.png',
						mimeType: 'image/png',
						fileSize: 1
					}
				],
				settings: { shadows: { baked: { assetId: BAKE_ID } } }
			} as never)
		})

		it('serves the bake the published settings declare', async () => {
			const response = await keyedGet(BAKE_ID)

			expect(response.status).toBe(200)
			expect(
				sceneSettingsService.getSceneSettingsWithAssetRefs
			).toHaveBeenCalledWith(SCENE_ID, { includeGltfJson: false })
			expect(downloadAsset).toHaveBeenCalledWith(BAKE_ID)
		})

		it('refuses a bake-named asset the published settings do not declare', async () => {
			vi.mocked(
				sceneSettingsService.getSceneSettingsWithAssetRefs
			).mockResolvedValue({
				assets: [
					{
						id: BAKE_ID,
						name: PERSISTED_BAKE_FILENAME,
						mimeType: 'image/png',
						fileSize: 1
					}
				],
				settings: {}
			} as never)

			const response = await keyedGet(BAKE_ID)

			expect(response.status).toBe(404)
			expect(downloadAsset).not.toHaveBeenCalled()
		})

		it('refuses a linked asset the embed manifest never references', async () => {
			const response = await keyedGet(DRAFT_ID)

			expect(response.status).toBe(404)
			expect(downloadAsset).not.toHaveBeenCalled()
		})
	})
})

describe('a session asset request', () => {
	const sessionPath = `/api/scenes/${SCENE_ID}/assets/${GLB_ID}?preview=1&projectId=p`

	beforeEach(() => {
		vi.mocked(getAuthUser).mockResolvedValue({
			user: { id: 'user-1' }
		} as never)
		vi.mocked(getPublishedScenePreview).mockResolvedValue(
			PUBLISHED_ROW as never
		)
	})

	it('serves a member the published GLB, which no scene_assets row names', async () => {
		vi.mocked(resolveSceneMembership).mockResolvedValue({
			organizationId: 'org-1',
			projectId: 'p',
			role: 'member',
			isResourceOwner: false
		})

		const response = await get(sessionPath)

		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toMatch(/^private,/)
		expect(getPublishedScenePreview).toHaveBeenCalledWith('p', SCENE_ID)
		expect(downloadAssetFromRow).toHaveBeenCalledWith({
			id: GLB_ID,
			filePath: 'project/scene.glb',
			mimeType: 'model/gltf-binary',
			name: 'scene.glb'
		})
	})

	it('refuses a member an asset that is neither linked nor published', async () => {
		vi.mocked(resolveSceneMembership).mockResolvedValue({
			organizationId: 'org-1',
			projectId: 'p',
			role: 'member',
			isResourceOwner: false
		})
		vi.mocked(getPublishedScenePreview).mockResolvedValue(null)

		const response = await get(sessionPath)

		expect(response.status).toBe(404)
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it('serves a member a linked draft asset', async () => {
		vi.mocked(resolveSceneMembership).mockResolvedValue({
			organizationId: 'org-1',
			projectId: 'p',
			role: 'member',
			isResourceOwner: false
		})
		vi.mocked(getPublishedScenePreview).mockResolvedValue(null)
		linkedRows.push({ assetId: GLB_ID })

		const response = await get(sessionPath)

		expect(response.status).toBe(200)
		expect(downloadAsset).toHaveBeenCalledWith(GLB_ID)
	})

	it('answers a non-member 404 before looking anything up', async () => {
		vi.mocked(resolveSceneMembership).mockResolvedValue(null)

		const response = await get(sessionPath)

		expect(response.status).toBe(404)
		expect(getPublishedScenePreview).not.toHaveBeenCalled()
		expect(downloadAssetFromRow).not.toHaveBeenCalled()
		expect(downloadAsset).not.toHaveBeenCalled()
	})
})
