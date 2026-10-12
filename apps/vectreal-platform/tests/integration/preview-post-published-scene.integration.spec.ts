/**
 * The session preview POST serves the working scene, so it must refuse a
 * published one, exactly as the GET manifest's rule does.
 *
 * `fetchManifestPayload` falls back to this POST whenever a manifest fails its
 * shape check. It used to answer with the draft whatever the publication
 * state, so on that path `/preview` and the dashboard showed a published
 * scene's unpublished edits.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const sessionUser = vi.hoisted(() => ({ id: '' }))

vi.mock('../../app/lib/http/auth.server', () => ({
	getAuthUser: async () => ({
		user: { id: sessionUser.id },
		headers: new Headers()
	})
}))

type Schema = typeof import('../../app/db/schema')
type SceneRoute = typeof import('../../app/routes/api/scenes.$sceneId')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('the session preview POST', () => {
	let schema: Schema
	let action: SceneRoute['action']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()
	const publishedSceneId = randomUUID()
	const draftSceneId = randomUUID()
	const publishedAssetId = randomUUID()

	/** `bodySceneId` defaults to the route's, as the client's fallback sends it. */
	function previewPost(sceneId: string, bodySceneId = sceneId) {
		const body = new FormData()
		body.append('action', 'get-scene-settings')
		body.append('sceneId', bodySceneId)

		const request = new Request(
			`http://localhost/api/scenes/${sceneId}?preview=1&projectId=${projectId}`,
			{ method: 'POST', headers: { origin: 'http://localhost' }, body }
		)

		return action({
			request,
			params: { sceneId }
		} as never) as Promise<Response>
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ action } = await import('../../app/routes/api/scenes.$sceneId'))
		db = (await import('../../app/db/client')).getDbClient()
		sessionUser.id = ownerId

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@smoke.test`,
			name: 'Owner'
		})
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `smoke-${organizationId}`, ownerId })
		await db.insert(schema.organizationMemberships).values({
			userId: ownerId,
			organizationId,
			role: 'owner'
		})
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Smoke project',
			slug: `smoke-${projectId}`
		})
		await db
			.insert(schema.folders)
			.values({ id: assetFolderId, projectId, name: 'Scene Assets' })
		await db.insert(schema.assets).values({
			id: publishedAssetId,
			folderId: assetFolderId,
			name: 'chair.glb',
			type: 'model',
			filePath: `smoke/${publishedAssetId}.glb`,
			mimeType: 'model/gltf-binary',
			fileSize: 1024,
			ownerId
		})

		await db.insert(schema.scenes).values([
			{
				id: publishedSceneId,
				projectId,
				folderId: null,
				name: 'Published chair',
				status: 'published'
			},
			{
				id: draftSceneId,
				projectId,
				folderId: null,
				name: 'Draft chair',
				status: 'draft'
			}
		])
		await db.insert(schema.sceneSettings).values([
			{ sceneId: publishedSceneId, createdBy: ownerId },
			{ sceneId: draftSceneId, createdBy: ownerId }
		])
		await db.insert(schema.scenePublished).values({
			sceneId: publishedSceneId,
			assetId: publishedAssetId,
			publishedBy: ownerId
		})
	})

	afterAll(async () => {
		// Organizations cascade to projects, folders, scenes and assets.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it("answers a member 404 for a published scene, never the draft's settings", async () => {
		const response = await previewPost(publishedSceneId)
		const body = await response.json()

		expect(response.status).toBe(404)
		expect(response.headers.get('cache-control')).toContain('no-store')
		expect(body.success).toBe(false)
		expect(body).not.toHaveProperty('data')
	})

	it('refuses a body naming another scene than the route', async () => {
		// The route's scene is an unpublished one the caller may read, so every
		// route-keyed check passes; only the body points at the published scene.
		const response = await previewPost(draftSceneId, publishedSceneId)
		const body = await response.json()

		expect(response.status).toBe(404)
		expect(body).not.toHaveProperty('data')
	})

	it('still hands a member the working scene of an unpublished one', async () => {
		const response = await previewPost(draftSceneId)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.data).toHaveProperty('settings')
	})
})
