/**
 * `POST /api/v1/projects` against real tables: the route action with only the
 * token check replaced, so the idempotency key, the create, the audit row and
 * the plan limit all run as they do in production.
 *
 * What a key promises is asserted as rows, not only as responses: a replay,
 * a concurrent duplicate and a refused retry each leave exactly the projects
 * the first request made.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { count, eq, inArray } from 'drizzle-orm'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

import type { AgentActor } from '../../app/lib/domain/agent/agent-actor.server'

const authorizeAgentRequest = vi.hoisted(() => vi.fn())

vi.mock('../../app/lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Route = typeof import('../../app/routes/api/v1/projects')

/** Over `STALE_CLAIM_MS`, written out so the test fails if the window grows. */
const STALE = 2 * 60 * 1000

describe('POST /api/v1/projects', () => {
	let schema: Schema
	let db: Db
	let route: Route

	const userId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const grantId = randomUUID()
	const otherGrantId = randomUUID()

	const actorFor = (grant: string, organizationId: string): AgentActor => ({
		userId,
		email: null,
		clientId: 'client-1',
		grantId: grant,
		organizationId,
		organizationName: 'Acme',
		role: 'owner',
		scopes: ['projects:read', 'projects:write']
	})

	async function create(
		name: string,
		key: string,
		actor = actorFor(grantId, orgId)
	) {
		authorizeAgentRequest.mockResolvedValue(actor)
		const request = new Request('https://vectreal.com/api/v1/projects', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Idempotency-Key': `"${key}"`
			},
			body: JSON.stringify({ name })
		})
		// The route throws refusals; read them like the framework does.
		const response = await route
			.action({ request, params: {}, context: {} } as never)
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

	const keyed = (key: string) =>
		new Request('https://vectreal.com/api/v1/projects', {
			method: 'POST',
			headers: { 'Idempotency-Key': `"${key}"` }
		})

	const keyRow = async (key: string) => {
		const [row] = await db
			.select()
			.from(schema.agentIdempotencyKeys)
			.where(eq(schema.agentIdempotencyKeys.key, key))
		return row
	}

	const projectsIn = async (organizationId: string) => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.projects)
			.where(eq(schema.projects.organizationId, organizationId))
		return row.total
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		route = await import('../../app/routes/api/v1/projects')

		await db.insert(schema.users).values({
			id: userId,
			email: `agent-${userId}@create.test`,
			name: 'Agent user'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `create-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `create-${otherOrgId}`, ownerId: userId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId, organizationId: orgId, role: 'owner' },
			{ userId, organizationId: otherOrgId, role: 'owner' }
		])
		await db.insert(schema.agentGrants).values([
			{
				id: grantId,
				userId,
				organizationId: orgId,
				oauthClientId: 'client-1',
				scopes: ['projects:read', 'projects:write']
			},
			{
				id: otherGrantId,
				userId,
				organizationId: otherOrgId,
				oauthClientId: 'client-2',
				scopes: ['projects:read', 'projects:write']
			}
		])
	})

	beforeEach(async () => {
		// Free allows one project, so each case starts from an empty organization.
		await db
			.delete(schema.projects)
			.where(inArray(schema.projects.organizationId, [orgId, otherOrgId]))
		await db
			.delete(schema.agentIdempotencyKeys)
			.where(
				inArray(schema.agentIdempotencyKeys.grantId, [grantId, otherGrantId])
			)
	})

	afterAll(async () => {
		await db
			.delete(schema.agentAuditEvents)
			.where(eq(schema.agentAuditEvents.userId, userId))
		await db
			.delete(schema.agentGrants)
			.where(eq(schema.agentGrants.userId, userId))
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

	it('creates once, audits it, and answers a retry with the same outcome', async () => {
		const first = await create('Chairs', 'retry-1')
		const retry = await create('Chairs', 'retry-1')

		expect(first.status).toBe(201)
		expect(retry.status).toBe(201)
		expect(retry.body).toEqual(first.body)
		expect(retry.headers.get('Idempotent-Replayed')).toBe('true')
		expect(first.headers.get('Idempotent-Replayed')).toBeNull()
		expect(await projectsIn(orgId)).toBe(1)

		const audit = await db
			.select()
			.from(schema.agentAuditEvents)
			.where(eq(schema.agentAuditEvents.targetId, first.body.data.project.id))
		expect(audit).toEqual([
			expect.objectContaining({
				grantId,
				oauthClientId: 'client-1',
				userId,
				organizationId: orgId,
				operation: 'project:create'
			})
		])
	})

	it('runs two concurrent requests with one key once', async () => {
		const answers = await Promise.all([
			create('Chairs', 'race-1'),
			create('Chairs', 'race-1')
		])

		expect(await projectsIn(orgId)).toBe(1)
		const statuses = answers.map(({ status }) => status).sort()
		// The second either saw the claim still open or the kept outcome.
		expect([
			[201, 409],
			[201, 201]
		]).toContainEqual(statuses)
	})

	it('creates concurrently past the pool size without starving it', async () => {
		// Every create holds a pooled connection for its transaction; a read
		// on a second one (the plan limit was one) deadlocks a full pool.
		const pool = Number(process.env.DB_POOL_MAX || '10')
		await db
			.insert(schema.orgLimitOverrides)
			.values({
				organizationId: orgId,
				limitKey: 'projects_total',
				limitValue: BigInt(pool * 2)
			})
			.onConflictDoNothing()

		const answers = await Promise.all(
			Array.from({ length: pool + 2 }, (_, i) =>
				create(`Chairs ${i}`, `pool-${i}`)
			)
		)

		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, orgId))
		expect(answers.map(({ status }) => status)).toEqual(
			Array(pool + 2).fill(201)
		)
		expect(await projectsIn(orgId)).toBe(pool + 2)
	}, 15_000)

	it('refuses the same key for a different request with 422, and creates nothing', async () => {
		await create('Chairs', 'reuse-1')
		const reused = await create('Tables', 'reuse-1')

		expect(reused.status).toBe(422)
		expect(reused.body.code).toBe('idempotency_key_reused')
		expect(await projectsIn(orgId)).toBe(1)
	})

	it('keeps keys apart per grant', async () => {
		const mine = await create('Chairs', 'shared-1')
		const theirs = await create(
			'Chairs',
			'shared-1',
			actorFor(otherGrantId, otherOrgId)
		)

		expect(mine.status).toBe(201)
		expect(theirs.status).toBe(201)
		expect(theirs.headers.get('Idempotent-Replayed')).toBeNull()
		expect(await projectsIn(orgId)).toBe(1)
		expect(await projectsIn(otherOrgId)).toBe(1)
	})

	it('answers the plan limit with 403 and the upgrade path, and replays that refusal', async () => {
		await create('Chairs', 'first-1')
		const refused = await create('Tables', 'second-1')
		const retried = await create('Tables', 'second-1')

		expect(refused.status).toBe(403)
		expect(refused.body).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'projects_total', plan: 'free' },
			upgradeUrl: 'https://vectreal.com/dashboard/billing/upgrade'
		})
		expect(retried.status).toBe(403)
		expect(retried.body).toEqual(refused.body)
		expect(retried.headers.get('Idempotent-Replayed')).toBe('true')
		expect(await projectsIn(orgId)).toBe(1)
	})

	it('answers 409 while a fresh claim is open, and takes over an abandoned one', async () => {
		const { fingerprintRequest } =
			await import('../../app/lib/domain/agent/agent-idempotency')
		const fingerprint = fingerprintRequest(
			new Request('https://vectreal.com/api/v1/projects', { method: 'POST' }),
			{ name: 'Chairs' }
		)
		await db.insert(schema.agentIdempotencyKeys).values([
			{ grantId, key: 'open-1', fingerprint },
			{
				grantId,
				key: 'abandoned-1',
				fingerprint,
				createdAt: new Date(Date.now() - 3 * 60 * 1000)
			}
		])

		const open = await create('Chairs', 'open-1')
		const abandoned = await create('Chairs', 'abandoned-1')

		expect(open.status).toBe(409)
		expect(open.body.code).toBe('idempotency_in_progress')
		expect(abandoned.status).toBe(201)
		expect(await projectsIn(orgId)).toBe(1)
	})

	it('never takes over a key that finished, however old its claim', async () => {
		// The first request can finish between a retry's read and its takeover.
		const { reclaimStaleIdempotencyKey } =
			await import('../../app/lib/domain/agent/agent-idempotency-repository.server')
		await db.insert(schema.agentIdempotencyKeys).values({
			grantId,
			key: 'finished-1',
			fingerprint: 'f',
			statusCode: 201,
			responseBody: {},
			createdAt: new Date(Date.now() - 3 * 60 * 1000)
		})

		await expect(
			reclaimStaleIdempotencyKey({ grantId, key: 'finished-1' }, 0)
		).resolves.toBeNull()
	})

	it('fences out the owner a takeover replaced: it can neither complete nor release the key', async () => {
		const repository =
			await import('../../app/lib/domain/agent/agent-idempotency-repository.server')
		const ref = { grantId, key: 'fenced-1' }
		const first = await repository.claimIdempotencyKey({
			...ref,
			fingerprint: 'f'
		})
		await db
			.update(schema.agentIdempotencyKeys)
			.set({ createdAt: new Date(Date.now() - 3 * 60 * 1000) })
			.where(eq(schema.agentIdempotencyKeys.key, 'fenced-1'))

		const second = await repository.reclaimStaleIdempotencyKey(ref, STALE)
		expect(second?.claimId).toBeDefined()
		expect(second?.claimId).not.toBe(first?.claimId)

		await repository.releaseIdempotencyKey(first!)
		expect(await keyRow('fenced-1')).toBeDefined()
		await expect(
			repository.inIdempotencyTransaction((tx) =>
				repository.completeIdempotencyKey(tx, first!, {
					statusCode: 201,
					responseBody: {}
				})
			)
		).resolves.toBe(false)
		await expect(
			repository.inIdempotencyTransaction((tx) =>
				repository.completeIdempotencyKey(tx, second!, {
					statusCode: 201,
					responseBody: {}
				})
			)
		).resolves.toBe(true)
	})

	it('commits nothing when the run fails after writing, and frees the key', async () => {
		const { withIdempotency } =
			await import('../../app/lib/domain/agent/agent-idempotency.server')
		const { createProject } =
			await import('../../app/lib/domain/project/project-repository.server')
		const failure = new Error('failed after the insert')

		await expect(
			withIdempotency(
				{ grantId, request: keyed('failed-1'), payload: { name: 'Chairs' } },
				async (tx) => {
					await createProject(orgId, 'Chairs', userId, tx)
					throw failure
				}
			)
		).rejects.toBe(failure)

		expect(await projectsIn(orgId)).toBe(0)
		expect(await keyRow('failed-1')).toBeUndefined()
		expect((await create('Chairs', 'failed-1')).status).toBe(201)
		expect(await projectsIn(orgId)).toBe(1)
	})

	it('rolls back a slow request whose claim was taken over, so only the new owner creates', async () => {
		const { withIdempotency } =
			await import('../../app/lib/domain/agent/agent-idempotency.server')
		const { createProject } =
			await import('../../app/lib/domain/project/project-repository.server')

		const slow = await withIdempotency(
			{ grantId, request: keyed('slow-1'), payload: { name: 'Chairs' } },
			async (tx) => {
				await createProject(orgId, 'Chairs', userId, tx)
				// A retry took the key over while this one ran.
				await db
					.update(schema.agentIdempotencyKeys)
					.set({ claimId: randomUUID() })
					.where(eq(schema.agentIdempotencyKeys.key, 'slow-1'))
				return Response.json({ success: true }, { status: 201 })
			}
		).catch((error: unknown) => error as Response)

		expect(slow.status).toBe(409)
		expect(await projectsIn(orgId)).toBe(0)
		expect((await keyRow('slow-1'))?.statusCode).toBeNull()
	})

	it('frees a key after a day, so it starts a new operation', async () => {
		await db.insert(schema.agentIdempotencyKeys).values({
			grantId,
			key: 'old-1',
			fingerprint: 'a request from yesterday',
			statusCode: 201,
			responseBody: {},
			createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
		})

		const reused = await create('Chairs', 'old-1')

		expect(reused.status).toBe(201)
		expect(reused.headers.get('Idempotent-Replayed')).toBeNull()
	})

	it("drops a grant's keys with the grant, and keeps its audit history", async () => {
		const throwaway = randomUUID()
		await db.insert(schema.agentGrants).values({
			id: throwaway,
			userId,
			organizationId: otherOrgId,
			oauthClientId: 'client-3',
			scopes: ['projects:read', 'projects:write']
		})
		const created = await create(
			'Chairs',
			'revoked-1',
			actorFor(throwaway, otherOrgId)
		)
		expect(created.status).toBe(201)

		await db
			.delete(schema.agentGrants)
			.where(eq(schema.agentGrants.id, throwaway))

		expect(
			await db
				.select()
				.from(schema.agentIdempotencyKeys)
				.where(eq(schema.agentIdempotencyKeys.grantId, throwaway))
		).toEqual([])
		expect(
			await db
				.select()
				.from(schema.agentAuditEvents)
				.where(eq(schema.agentAuditEvents.grantId, throwaway))
		).toHaveLength(1)
	})
})
