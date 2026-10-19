/**
 * `POST` and `DELETE /api/v1/scenes/:sceneId/publication` against real
 * tables: the route actions with only the token check and storage replaced,
 * so the idempotency key, the publish rows, the plan limits, the audit row and
 * the collection of replaced GLBs all run as they do in production. Scenes are
 * created through `POST /api/v1/projects/:projectId/scenes`, the way an agent
 * makes them.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { and, count, eq, inArray, sql } from 'drizzle-orm'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type Mock
} from 'vitest'

import type { AgentActor } from '../../app/lib/domain/agent/agent-actor.server'

const { authorizeAgentRequest, storage } = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	storage: { uploaded: [] as string[], removed: [] as string[] }
}))

vi.mock('../../app/lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))
vi.mock('../../app/lib/domain/agent/agent-audit.server', async (original) => {
	const actual =
		await original<
			typeof import('../../app/lib/domain/agent/agent-audit.server')
		>()
	return { recordAgentAudit: vi.fn(actual.recordAgentAudit) }
})
vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				upload: async (path: string) => {
					storage.uploaded.push(path)
					return { data: { path }, error: null }
				},
				remove: async (paths: string[]) => {
					storage.removed.push(...paths)
					return { data: null, error: null }
				}
			})
		}
	})
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type ScenesRoute =
	typeof import('../../app/routes/api/v1/projects.$projectId.scenes')
type PublicationRoute =
	typeof import('../../app/routes/api/v1/scenes.$sceneId.publication')

const fixture = (path: string) =>
	new Uint8Array(readFileSync(join(import.meta.dirname, '../../../..', path)))
const BOX = fixture('packages/viewer-e2e/src/consumer-template/public/box.glb')
const ROCKET = fixture(
	'apps/vectreal-platform/app/assets/models/rocket-balanced.glb'
)

describe('/api/v1/scenes/:sceneId/publication', () => {
	let schema: Schema
	let db: Db
	let scenesRoute: ScenesRoute
	let publicationRoute: PublicationRoute
	let recordAgentAudit: Mock

	const userId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const grantId = randomUUID()
	let projectId: string

	const actor: AgentActor = {
		userId,
		email: null,
		clientId: 'client-1',
		grantId,
		organizationId: orgId,
		organizationName: 'Acme',
		role: 'owner',
		scopes: ['projects:read', 'projects:write', 'scenes:publish']
	}

	async function answer(promise: Promise<Response>) {
		const response = await promise.catch((error: unknown) => {
			if (error instanceof Response) return error
			throw error
		})
		return {
			status: response.status,
			headers: response.headers,
			body: await response.json()
		}
	}

	async function createScene(project = projectId, actingAs = actor) {
		authorizeAgentRequest.mockResolvedValue(actingAs)
		const form = new FormData()
		form.set('name', 'Box')
		form.set('file', new Blob([BOX]))
		const created = await answer(
			scenesRoute.action({
				request: new Request(
					`https://vectreal.com/api/v1/projects/${project}/scenes`,
					{
						method: 'POST',
						headers: { 'Idempotency-Key': `"create-${randomUUID()}"` },
						body: form
					}
				),
				params: { projectId: project },
				context: {}
			} as never)
		)
		expect(created.status).toBe(201)
		return created.body.data.scene.id as string
	}

	function publish(sceneId: string, key: string, glb = ROCKET) {
		authorizeAgentRequest.mockResolvedValue(actor)
		const form = new FormData()
		form.set('file', new Blob([glb]))
		return answer(
			publicationRoute.action({
				request: new Request(
					`https://vectreal.com/api/v1/scenes/${sceneId}/publication`,
					{
						method: 'POST',
						headers: { 'Idempotency-Key': `"${key}"` },
						body: form
					}
				),
				params: { sceneId },
				context: {}
			} as never)
		)
	}

	function unpublish(sceneId: string, key: string) {
		authorizeAgentRequest.mockResolvedValue(actor)
		return answer(
			publicationRoute.action({
				request: new Request(
					`https://vectreal.com/api/v1/scenes/${sceneId}/publication`,
					{ method: 'DELETE', headers: { 'Idempotency-Key': `"${key}"` } }
				),
				params: { sceneId },
				context: {}
			} as never)
		)
	}

	const publication = async (sceneId: string) => {
		const [row] = await db
			.select()
			.from(schema.scenePublished)
			.where(eq(schema.scenePublished.sceneId, sceneId))
		return row
	}

	const sceneState = async (sceneId: string) => {
		const [scene] = await db
			.select({ status: schema.scenes.status })
			.from(schema.scenes)
			.where(eq(schema.scenes.id, sceneId))
		const [stats] = await db
			.select({ bytes: schema.sceneStats.currentSceneBytes })
			.from(schema.sceneStats)
			.where(eq(schema.sceneStats.sceneId, sceneId))
		return { status: scene?.status, bytes: stats?.bytes ?? null }
	}

	/** The stored GLBs in the project, published or not. */
	const glbAssets = async (project = projectId) =>
		db
			.select({ id: schema.assets.id })
			.from(schema.assets)
			.innerJoin(schema.folders, eq(schema.folders.id, schema.assets.folderId))
			.where(
				and(
					eq(schema.folders.projectId, project),
					eq(schema.assets.mimeType, 'model/gltf-binary')
				)
			)

	const limit = (limitKey: string, value: number) =>
		db
			.insert(schema.orgLimitOverrides)
			.values({ organizationId: orgId, limitKey, limitValue: BigInt(value) })

	beforeAll(async () => {
		// Read by the storage client, which the mock above replaces.
		vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:1')
		vi.stubEnv('SUPABASE_SECRET_KEY', 'test')
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		scenesRoute =
			await import('../../app/routes/api/v1/projects.$projectId.scenes')
		publicationRoute =
			await import('../../app/routes/api/v1/scenes.$sceneId.publication')
		recordAgentAudit = (
			await import('../../app/lib/domain/agent/agent-audit.server')
		).recordAgentAudit as Mock

		await db.insert(schema.users).values({
			id: userId,
			email: `agent-${userId}@publish.test`,
			name: 'Agent user'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `publish-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `publish-${otherOrgId}`, ownerId: userId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId, organizationId: orgId, role: 'owner' },
			{ userId, organizationId: otherOrgId, role: 'owner' }
		])
		await db.insert(schema.agentGrants).values({
			id: grantId,
			userId,
			organizationId: orgId,
			oauthClientId: 'client-1',
			scopes: ['projects:read', 'projects:write', 'scenes:publish']
		})
	})

	beforeEach(async () => {
		storage.uploaded.length = 0
		storage.removed.length = 0
		recordAgentAudit.mockClear()
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, orgId))
		await db
			.delete(schema.agentIdempotencyKeys)
			.where(eq(schema.agentIdempotencyKeys.grantId, grantId))
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: orgId, name: `Publish ${randomUUID()}` })
			.returning({ id: schema.projects.id })
		projectId = project.id
	})

	afterAll(async () => {
		await db
			.delete(schema.agentAuditEvents)
			.where(eq(schema.agentAuditEvents.userId, userId))
		await db
			.delete(schema.agentGrants)
			.where(eq(schema.agentGrants.userId, userId))
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, orgId))
		const projectIds = (
			await db
				.select({ id: schema.projects.id })
				.from(schema.projects)
				.where(inArray(schema.projects.organizationId, [orgId, otherOrgId]))
		).map((row) => row.id)
		if (projectIds.length > 0) {
			await db
				.delete(schema.scenes)
				.where(inArray(schema.scenes.projectId, projectIds))
			const folderIds = (
				await db
					.select({ id: schema.folders.id })
					.from(schema.folders)
					.where(inArray(schema.folders.projectId, projectIds))
			).map((row) => row.id)
			if (folderIds.length > 0) {
				await db
					.delete(schema.assets)
					.where(inArray(schema.assets.folderId, folderIds))
			}
		}
		await db
			.delete(schema.projects)
			.where(inArray(schema.projects.organizationId, [orgId, otherOrgId]))
		await db
			.delete(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.userId, userId))
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, [orgId, otherOrgId]))
		await db.delete(schema.users).where(eq(schema.users.id, userId))
	})

	it('publishes the GLB, records the size and the audit row, and replays a retry without storing more', async () => {
		const sceneId = await createScene()

		const first = await publish(sceneId, 'publish-1')
		const retry = await publish(sceneId, 'publish-1')

		expect(first.status).toBe(200)
		expect(first.body.data.publication).toMatchObject({
			sceneId,
			status: 'published'
		})
		expect(retry.body).toEqual(first.body)
		expect(retry.headers.get('Idempotent-Replayed')).toBe('true')

		const row = await publication(sceneId)
		expect(row).toBeDefined()
		expect(await sceneState(sceneId)).toEqual({
			status: 'published',
			bytes: ROCKET.byteLength
		})
		expect(await glbAssets()).toEqual([{ id: row.assetId }])

		const [stored] = await db
			.select({ metadata: schema.assets.metadata })
			.from(schema.assets)
			.where(eq(schema.assets.id, row.assetId))
		expect(stored.metadata).toMatchObject({
			gltfExtensionsUsed: expect.arrayContaining(['KHR_draco_mesh_compression'])
		})

		const audit = await db
			.select()
			.from(schema.agentAuditEvents)
			.where(
				and(
					eq(schema.agentAuditEvents.targetId, sceneId),
					eq(schema.agentAuditEvents.operation, 'scene:publish')
				)
			)
		expect(audit).toHaveLength(1)
	})

	it('swaps the GLB on a republish and collects the old one, but not one another scene still publishes', async () => {
		const sceneA = await createScene()
		const sceneB = await createScene()
		await publish(sceneA, 'swap-a1', ROCKET)
		// The same bytes on B reuse A's row, since A references it.
		await publish(sceneB, 'swap-b1', ROCKET)
		const shared = (await publication(sceneA)).assetId
		expect((await publication(sceneB)).assetId).toBe(shared)

		const republished = await publish(sceneA, 'swap-a2', BOX)

		expect(republished.status).toBe(200)
		expect((await publication(sceneA)).assetId).not.toBe(shared)
		const ids = (await glbAssets()).map((asset) => asset.id)
		expect(ids).toContain(shared)

		await publish(sceneB, 'swap-b2', BOX)
		expect((await glbAssets()).map((asset) => asset.id)).not.toContain(shared)
	})

	it('answers the concurrent-publish limit with a kept 403 and stores nothing', async () => {
		const sceneId = await createScene()
		await limit('scenes_published_concurrent', 0)

		const refused = await publish(sceneId, 'limit-1')
		const replayed = await publish(sceneId, 'limit-1')

		expect(refused.status).toBe(403)
		expect(refused.body).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'scenes_published_concurrent' }
		})
		expect(replayed.body).toEqual(refused.body)
		expect(await publication(sceneId)).toBeUndefined()
		expect(await glbAssets()).toEqual([])
	})

	it('answers the per-scene size limit with a 403 and stores nothing', async () => {
		const sceneId = await createScene()
		await limit('storage_bytes_per_scene', 1)

		const refused = await publish(sceneId, 'size-1')

		expect(refused.status).toBe(403)
		expect(refused.body).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'storage_bytes_per_scene' }
		})
		expect(await publication(sceneId)).toBeUndefined()
		expect(await glbAssets()).toEqual([])
	})

	it('takes a scene offline and collects its GLB; a scene never published stays a draft', async () => {
		const sceneId = await createScene()
		await publish(sceneId, 'offline-1')

		const offline = await unpublish(sceneId, 'offline-2')

		expect(offline.status).toBe(200)
		expect(offline.body.data.publication).toEqual({
			sceneId,
			status: 'draft',
			publishedAt: null
		})
		expect(await publication(sceneId)).toBeUndefined()
		expect(await sceneState(sceneId)).toEqual({ status: 'draft', bytes: null })
		expect(await glbAssets()).toEqual([])

		const draft = await createScene()
		expect((await unpublish(draft, 'offline-3')).status).toBe(200)
	})

	it('commits nothing and reclaims the GLB when the publish fails after the upload, then lets the retry run', async () => {
		const sceneId = await createScene()
		recordAgentAudit.mockRejectedValueOnce(new Error('audit down'))

		await expect(publish(sceneId, 'fail-1')).rejects.toThrow('audit down')

		expect(await publication(sceneId)).toBeUndefined()
		expect(await sceneState(sceneId)).toMatchObject({ status: 'draft' })
		expect(await glbAssets()).toEqual([])

		const retry = await publish(sceneId, 'fail-1')
		expect(retry.status).toBe(200)
		expect(retry.headers.get('Idempotent-Replayed')).toBeNull()
	})

	it("answers 404 for a scene outside the grant's organization", async () => {
		const [other] = await db
			.insert(schema.projects)
			.values({ organizationId: otherOrgId, name: `Other ${randomUUID()}` })
			.returning({ id: schema.projects.id })
		const sceneId = await createScene(other.id, {
			...actor,
			organizationId: otherOrgId
		})

		const refused = await publish(sceneId, 'other-1')

		expect(refused.status).toBe(404)
		expect(refused.body.code).toBe('not_found')
		expect(await publication(sceneId)).toBeUndefined()
	})

	it('publishes on the one connection its transaction holds', async () => {
		const sceneId = await createScene()
		// Every other pooled connection is held, so a publish that reaches for
		// a second one while its transaction is open waits forever.
		const pool = Number(process.env.DB_POOL_MAX || '10')
		let release!: () => void
		const released = new Promise<void>((resolve) => (release = resolve))
		let holding = 0
		const holders = Array.from({ length: pool - 1 }, () =>
			db.transaction(async (tx) => {
				await tx.execute(sql`select 1`)
				holding += 1
				await released
			})
		)
		while (holding < pool - 1) await new Promise((r) => setTimeout(r, 10))

		const outcome = await Promise.race([
			publish(sceneId, 'one-connection-1').then((answer) => answer.status),
			new Promise((resolve) => setTimeout(() => resolve('starved'), 10_000))
		])
		release()
		await Promise.all(holders)

		expect(outcome).toBe(200)
		const [row] = await db
			.select({ total: count() })
			.from(schema.scenePublished)
			.where(eq(schema.scenePublished.sceneId, sceneId))
		expect(row.total).toBe(1)
	}, 30_000)
})
