/**
 * The asset route's caching and authorization, with storage and the database
 * mocked out.
 *
 * A signed request is answered with no key or scene lookup and is cached at
 * the edge, so the route must refuse every request the signature does not
 * cover and keep every other response private: a public response on the key
 * or session path would let the edge serve one caller's asset to another.
 */
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
		getPublishedScenePreview: vi.fn()
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
import { buildSignedAssetUrl } from '../app/lib/domain/embed/embed-asset-signature.server'
import { getPublishedScenePreview } from '../app/lib/domain/scene/server/scene-preview-repository.server'
import { getAuthUser } from '../app/lib/http/auth.server'
import { reportServerError } from '../app/lib/observability/report-server-error.server'
import { loader } from '../app/routes/api/scenes.$sceneId.assets.$assetId'

import type { LoaderFunctionArgs } from 'react-router'

const SECRET = 'route-test-secret'
const SCENE_ID = 'scene-1'
const GLB_ID = 'glb-1'
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

const signedPath = () =>
	buildSignedAssetUrl(
		{ sceneId: SCENE_ID, assetId: GLB_ID },
		SECRET,
		Date.now()
	)

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
	beforeEach(() => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', SECRET)
	})

	it('is served publicly for as long as its URL stays valid', async () => {
		const response = await get(signedPath())

		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toMatch(
			/^public, max-age=(\d+), s-maxage=\1$/
		)
		expect(downloadAsset).toHaveBeenCalledWith(GLB_ID)
	})

	it('is refused, downloading nothing, without a signing secret', async () => {
		const path = signedPath()
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', '')

		const response = await get(path)

		expect(response.status).toBe(404)
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it('is refused, downloading nothing, with a tampered signature', async () => {
		const signed = signedPath()
		const tampered = signed.replace(
			/sig=(.)/,
			(_, first: string) => `sig=${first === 'A' ? 'B' : 'A'}`
		)
		expect(tampered).not.toBe(signed)

		const response = await get(tampered)

		expect(response.status).toBe(404)
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it('is refused at any other spelling of its path', async () => {
		const [path, query] = signedPath().split('?')

		const response = await get(`${path}/?${query}`)

		expect(response.status).toBe(404)
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it('is refused for any method but GET, downloading nothing', async () => {
		const response = await get(signedPath(), 'HEAD')

		expect(response.status).toBe(405)
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it('answers an asset a republish deleted with a quiet 404', async () => {
		vi.mocked(downloadAsset).mockRejectedValue(new AssetNotFoundError(GLB_ID))

		const response = await get(signedPath())

		expect(response.status).toBe(404)
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
})

describe('a session asset request', () => {
	const sessionPath = `/api/scenes/${SCENE_ID}/assets/${GLB_ID}?preview=1&projectId=p`

	beforeEach(() => {
		vi.mocked(getAuthUser).mockResolvedValue({
			user: { id: 'user-1' },
			headers: new Headers()
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
