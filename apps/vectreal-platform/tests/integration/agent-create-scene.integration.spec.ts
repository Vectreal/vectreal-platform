/**
 * `POST /api/v1/projects/:projectId/scenes` against real tables: the route
 * action with only the token check and storage replaced, so the idempotency
 * key, the scene save, the asset rows, the audit row and the plan limits all
 * run as they do in production.
 *
 * Storage is faked at the `createClient` boundary and records what was
 * written and removed, so a reclaimed upload shows as a removal.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { count, eq, inArray, sql } from 'drizzle-orm'
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
type Route = typeof import('../../app/routes/api/v1/projects.$projectId.scenes')

const fixture = (path: string) =>
	new Uint8Array(readFileSync(join(import.meta.dirname, '../../../..', path)))
const BOX = fixture('packages/viewer-e2e/src/consumer-template/public/box.glb')
const ROCKET = fixture(
	'apps/vectreal-platform/app/assets/models/rocket-balanced.glb'
)

describe('POST /api/v1/projects/:projectId/scenes', () => {
	let schema: Schema
	let db: Db
	let route: Route
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
		scopes: ['projects:read', 'projects:write']
	}

	async function create(
		key: string,
		{ name = 'Box', glb = BOX, project = projectId } = {}
	) {
		authorizeAgentRequest.mockResolvedValue(actor)
		const form = new FormData()
		form.set('name', name)
		form.set('file', new Blob([glb]))
		const request = new Request(
			`https://vectreal.com/api/v1/projects/${project}/scenes`,
			{ method: 'POST', headers: { 'Idempotency-Key': `"${key}"` }, body: form }
		)
		// The route throws refusals; read them like the framework does.
		const response = await route
			.action({ request, params: { projectId: project }, context: {} } as never)
			.catch((error: unknown) => {
				if (error instanceof Response) return error
				throw error
			})
		return {
			status: response.status,
			headers: response.headers,
			body: await response.json()
		}
	}

	const scenesIn = async (project = projectId) => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.scenes)
			.where(eq(schema.scenes.projectId, project))
		return row.total
	}

	const assetsIn = async (project = projectId) =>
		db
			.select({
				id: schema.assets.id,
				name: schema.assets.name,
				mimeType: schema.assets.mimeType
			})
			.from(schema.assets)
			.innerJoin(schema.folders, eq(schema.folders.id, schema.assets.folderId))
			.where(eq(schema.folders.projectId, project))

	const linkedAssets = async (sceneId: string) =>
		db
			.select({ name: schema.assets.name, mimeType: schema.assets.mimeType })
			.from(schema.sceneAssets)
			.innerJoin(
				schema.sceneSettings,
				eq(schema.sceneSettings.id, schema.sceneAssets.sceneSettingsId)
			)
			.innerJoin(
				schema.assets,
				eq(schema.assets.id, schema.sceneAssets.assetId)
			)
			.where(eq(schema.sceneSettings.sceneId, sceneId))

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
		route = await import('../../app/routes/api/v1/projects.$projectId.scenes')
		recordAgentAudit = (
			await import('../../app/lib/domain/agent/agent-audit.server')
		).recordAgentAudit as Mock

		await db.insert(schema.users).values({
			id: userId,
			email: `agent-${userId}@scene.test`,
			name: 'Agent user'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `scene-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `scene-${otherOrgId}`, ownerId: userId }
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
			scopes: ['projects:read', 'projects:write']
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
		// A fresh project per case, so counts start at zero.
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: orgId, name: `Scenes ${randomUUID()}` })
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

	it('creates the scene with its glTF and bin linked, audits it, and replays a retry', async () => {
		const first = await create('box-1')
		const retry = await create('box-1')

		expect(first.status).toBe(201)
		const sceneId = first.body.data.scene.id
		expect(first.body.data.scene).toEqual({
			id: sceneId,
			projectId,
			name: 'Box'
		})
		expect(retry.body).toEqual(first.body)
		expect(retry.headers.get('Idempotent-Replayed')).toBe('true')

		expect(await scenesIn()).toBe(1)
		const [scene] = await db
			.select({ name: schema.scenes.name })
			.from(schema.scenes)
			.where(eq(schema.scenes.id, sceneId))
		expect(scene.name).toBe('Box')
		expect(await linkedAssets(sceneId)).toEqual(
			expect.arrayContaining([
				{ name: 'scene.gltf', mimeType: 'model/gltf+json' },
				{ name: 'scene.bin', mimeType: 'application/octet-stream' }
			])
		)
		// The retry stored nothing more.
		expect(await assetsIn()).toHaveLength(2)

		const [settings] = await db
			.select({ id: schema.sceneSettings.id })
			.from(schema.sceneSettings)
			.where(eq(schema.sceneSettings.sceneId, sceneId))
		expect(settings).toBeDefined()

		const audit = await db
			.select()
			.from(schema.agentAuditEvents)
			.where(eq(schema.agentAuditEvents.targetId, sceneId))
		expect(audit).toEqual([
			expect.objectContaining({ grantId, operation: 'scene:create' })
		])
	})

	it('stores a Draco-compressed GLB as it is', async () => {
		const created = await create('rocket-1', { name: 'Rocket', glb: ROCKET })

		expect(created.status).toBe(201)
		expect(
			(await linkedAssets(created.body.data.scene.id)).map((a) => a.name).sort()
		).toEqual(['scene.bin', 'scene.gltf'])
	})

	it('runs two concurrent requests with one key once', async () => {
		const answers = await Promise.all([create('race-1'), create('race-1')])

		// One creates; the other replays it or finds it still running.
		const statuses = answers.map((answer) => answer.status).sort()
		expect([
			[201, 201],
			[201, 409]
		]).toContainEqual(statuses)
		expect(await scenesIn()).toBe(1)
	})

	it('refuses the same key with another file with 422, and stores nothing more', async () => {
		await create('reuse-1')

		const reused = await create('reuse-1', { glb: ROCKET })

		expect(reused.status).toBe(422)
		expect(reused.body.code).toBe('idempotency_key_reused')
		expect(await scenesIn()).toBe(1)
		expect(await assetsIn()).toHaveLength(2)
	})

	it('answers the scene limit with a kept 403 and stores nothing', async () => {
		await limit('scenes_total', 0)

		const refused = await create('limit-1')
		const replayed = await create('limit-1')

		expect(refused.status).toBe(403)
		expect(refused.body).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'scenes_total' }
		})
		expect(replayed.body).toEqual(refused.body)
		expect(replayed.headers.get('Idempotent-Replayed')).toBe('true')
		expect(await scenesIn()).toBe(0)
		expect(await assetsIn()).toHaveLength(0)
	})

	it('answers the storage limit with a 403 and leaves no asset rows', async () => {
		await limit('storage_bytes_total', 1)

		const refused = await create('storage-1')

		expect(refused.status).toBe(403)
		expect(refused.body).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'storage_bytes_total' }
		})
		expect(await assetsIn()).toHaveLength(0)
		expect(storage.uploaded).toHaveLength(0)
	})

	it('commits nothing and reclaims the uploads when the save fails after them, then lets the retry run', async () => {
		recordAgentAudit.mockRejectedValueOnce(new Error('audit down'))

		await expect(create('fail-1')).rejects.toThrow('audit down')

		expect(await scenesIn()).toBe(0)
		expect(await assetsIn()).toHaveLength(0)
		expect(storage.uploaded.length).toBeGreaterThan(0)
		expect(storage.removed.sort()).toEqual([...storage.uploaded].sort())

		const retry = await create('fail-1')
		expect(retry.status).toBe(201)
		expect(retry.headers.get('Idempotent-Replayed')).toBeNull()
		expect(await scenesIn()).toBe(1)
	})

	it("answers 404 for a project outside the grant's organization", async () => {
		const [other] = await db
			.insert(schema.projects)
			.values({ organizationId: otherOrgId, name: `Other ${randomUUID()}` })
			.returning({ id: schema.projects.id })

		const refused = await create('other-1', { project: other.id })

		expect(refused.status).toBe(404)
		expect(refused.body.code).toBe('not_found')
		expect(await scenesIn(other.id)).toBe(0)
	})

	it('saves on the one connection its transaction holds', async () => {
		// Every other pooled connection is held, so a create that reaches for a
		// second one while its transaction is open waits forever.
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
			create('one-connection-1').then((answer) => answer.status),
			new Promise((resolve) => setTimeout(() => resolve('starved'), 10_000))
		])
		release()
		await Promise.all(holders)

		expect(outcome).toBe(201)
	}, 30_000)

	it('creates concurrently past the pool size without starving it', async () => {
		// Every save holds a pooled connection for its transaction; any read on a
		// second one deadlocks a full pool.
		const pool = Number(process.env.DB_POOL_MAX || '10')
		await limit('scenes_total', pool * 4)

		const answers = await Promise.all(
			Array.from({ length: pool + 2 }, (_, i) =>
				create(`pool-${i}`, { name: `Box ${i}` })
			)
		)

		expect(answers.map((answer) => answer.status)).toEqual(
			Array(pool + 2).fill(201)
		)
		expect(await scenesIn()).toBe(pool + 2)
	})
})
