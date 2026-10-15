/**
 * The thumbnail route's authorization, with storage and the database mocked
 * out.
 *
 * It follows the assets route: scene membership is the gate and runs before
 * anything about the asset is read, so a non-member cannot tell a real
 * thumbnail id from a made-up one. Past the gate, the asset has to be the one
 * `scenes.thumbnail_url` names; the asset row's own `metadata.sceneId` is not
 * consulted, because de-duplication shares one row between scenes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../app/lib/domain/asset/asset-storage.server', () => ({
	downloadAsset: vi.fn(),
	findSceneThumbnailAsset: vi.fn()
}))

vi.mock('../app/lib/domain/dashboard/dashboard-permissions.server', () => ({
	resolveSceneMembership: vi.fn()
}))

vi.mock('../app/lib/http/auth.server', () => ({ getAuthUser: vi.fn() }))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))

import {
	downloadAsset,
	findSceneThumbnailAsset
} from '../app/lib/domain/asset/asset-storage.server'
import { resolveSceneMembership } from '../app/lib/domain/dashboard/dashboard-permissions.server'
import { getAuthUser } from '../app/lib/http/auth.server'
import { loader } from '../app/routes/api/scenes.$sceneId.thumbnail.$assetId'

import type { LoaderFunctionArgs } from 'react-router'

const SCENE_ID = '11111111-1111-4111-8111-111111111111'
const ASSET_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = 'user-1'
const UPDATED_AT = new Date('2026-10-01T12:00:00Z')

const get = (sceneId = SCENE_ID, assetId = ASSET_ID) =>
	loader({
		request: new Request(
			`https://vectreal.test/api/scenes/${sceneId}/thumbnail/${assetId}`
		),
		params: { sceneId, assetId }
	} as unknown as LoaderFunctionArgs) as Promise<Response>

const membership = {
	organizationId: 'org-1',
	projectId: 'project-1',
	role: 'member',
	isResourceOwner: false
} as const

beforeEach(() => {
	vi.mocked(getAuthUser).mockResolvedValue({
		user: { id: USER_ID },
		headers: new Headers()
	} as never)
	vi.mocked(downloadAsset).mockResolvedValue({
		data: new Uint8Array([1, 2, 3]),
		mimeType: 'image/webp',
		fileName: 'scene-thumbnail.webp'
	})
})

afterEach(() => {
	vi.clearAllMocks()
})

describe('a non-member', () => {
	it('gets 404 before anything about the asset is read', async () => {
		vi.mocked(resolveSceneMembership).mockResolvedValue(null)
		vi.mocked(findSceneThumbnailAsset).mockResolvedValue({
			updatedAt: UPDATED_AT
		})

		const response = await get()

		expect(response.status).toBe(404)
		expect(resolveSceneMembership).toHaveBeenCalledWith(SCENE_ID, USER_ID)
		expect(findSceneThumbnailAsset).not.toHaveBeenCalled()
		expect(downloadAsset).not.toHaveBeenCalled()
	})
})

describe('a malformed scene id', () => {
	it('gets 404 without reaching Postgres', async () => {
		const response = await get('not-a-uuid')

		expect(response.status).toBe(404)
		expect(resolveSceneMembership).not.toHaveBeenCalled()
		expect(findSceneThumbnailAsset).not.toHaveBeenCalled()
	})
})

describe('a member', () => {
	beforeEach(() => {
		vi.mocked(resolveSceneMembership).mockResolvedValue(membership)
	})

	it("gets 404 for an asset that is not the scene's thumbnail", async () => {
		vi.mocked(findSceneThumbnailAsset).mockResolvedValue(undefined)

		const response = await get()

		expect(response.status).toBe(404)
		expect(findSceneThumbnailAsset).toHaveBeenCalledWith(SCENE_ID, ASSET_ID)
		expect(downloadAsset).not.toHaveBeenCalled()
	})

	it("gets the scene's thumbnail, privately cached and sandboxed", async () => {
		vi.mocked(findSceneThumbnailAsset).mockResolvedValue({
			updatedAt: UPDATED_AT
		})

		const response = await get()

		expect(response.status).toBe(200)
		expect(downloadAsset).toHaveBeenCalledWith(ASSET_ID)
		expect(Object.fromEntries(response.headers)).toMatchObject({
			'content-type': 'image/webp',
			'cache-control': 'private, max-age=31536000, immutable',
			'last-modified': UPDATED_AT.toUTCString(),
			'x-content-type-options': 'nosniff',
			'content-security-policy': 'sandbox'
		})
	})
})
