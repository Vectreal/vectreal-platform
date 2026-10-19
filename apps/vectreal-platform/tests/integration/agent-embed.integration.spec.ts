/**
 * The v1 embed routes against real tables: embed keys, the project's allowed
 * domains and the scene's embed, with only the token check replaced. The key
 * table, the plan limit, the idempotency table and the audit rows run as in
 * production, and the snippet's URL is checked against the same key lookup
 * and host rule the embed page uses.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { and, eq, inArray, sql } from 'drizzle-orm'
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

const { authorizeAgentRequest } = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn()
}))

vi.mock('../../app/lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type KeysRoute =
	typeof import('../../app/routes/api/v1/projects.$projectId.embed-keys')
type DomainsRoute =
	typeof import('../../app/routes/api/v1/projects.$projectId.allowed-domains')
type EmbedRoute = typeof import('../../app/routes/api/v1/scenes.$sceneId.embed')
type PreviewAuth =
	typeof import('../../app/lib/domain/auth/preview-api-key-auth.server')

const ORIGIN = 'https://vectreal.test'

describe('/api/v1 embed keys, allowed domains and the scene embed', () => {
	let schema: Schema
	let db: Db
	let keysRoute: KeysRoute
	let domainsRoute: DomainsRoute
	let embedRoute: EmbedRoute
	let previewAuth: PreviewAuth

	const userId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const grantId = randomUUID()
	let projectId: string
	let sceneId: string

	const actor: AgentActor = {
		userId,
		email: null,
		clientId: 'client-1',
		grantId,
		organizationId: orgId,
		organizationName: 'Acme',
		role: 'owner',
		scopes: ['projects:read', 'embed:manage']
	}

	async function answer(promise: Promise<Response>) {
		const response = await promise.catch((error: unknown) => {
			if (error instanceof Response) return error
			throw error
		})
		return {
			status: response.status,
			headers: response.headers,
			text: await response.text()
		}
	}
	const json = (result: { text: string }) => JSON.parse(result.text)

	function createKey(key: string, name = 'Shop page', project = projectId) {
		authorizeAgentRequest.mockResolvedValue(actor)
		return answer(
			keysRoute.action({
				request: new Request(
					`${ORIGIN}/api/v1/projects/${project}/embed-keys`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Idempotency-Key': `"${key}"`
						},
						body: JSON.stringify({ name })
					}
				),
				params: { projectId: project },
				context: {}
			} as never)
		)
	}

	function setDomains(key: string, domains: string[]) {
		authorizeAgentRequest.mockResolvedValue(actor)
		return answer(
			domainsRoute.action({
				request: new Request(
					`${ORIGIN}/api/v1/projects/${projectId}/allowed-domains`,
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							'Idempotency-Key': `"${key}"`
						},
						body: JSON.stringify({ domains })
					}
				),
				params: { projectId },
				context: {}
			} as never)
		)
	}

	function getDomains() {
		authorizeAgentRequest.mockResolvedValue(actor)
		return answer(
			domainsRoute.loader({
				request: new Request(
					`${ORIGIN}/api/v1/projects/${projectId}/allowed-domains`
				),
				params: { projectId },
				context: {}
			} as never)
		)
	}

	function getEmbed(scene = sceneId) {
		authorizeAgentRequest.mockResolvedValue(actor)
		return answer(
			embedRoute.loader({
				request: new Request(`${ORIGIN}/api/v1/scenes/${scene}/embed`),
				params: { sceneId: scene },
				context: {}
			} as never)
		)
	}

	const projectKeys = (project = projectId) =>
		db
			.select({
				id: schema.apiKeys.id,
				encryptedKey: schema.apiKeys.encryptedKey
			})
			.from(schema.apiKeys)
			.innerJoin(
				schema.apiKeyProjects,
				eq(schema.apiKeyProjects.apiKeyId, schema.apiKeys.id)
			)
			.where(eq(schema.apiKeyProjects.projectId, project))

	const audit = (operation: string, targetId: string) =>
		db
			.select()
			.from(schema.agentAuditEvents)
			.where(
				and(
					eq(schema.agentAuditEvents.operation, operation),
					eq(schema.agentAuditEvents.targetId, targetId)
				)
			)

	async function publishedScene(project: string) {
		const [folder] = await db
			.insert(schema.folders)
			.values({ id: randomUUID(), projectId: project, name: 'Assets' })
			.returning({ id: schema.folders.id })
		const [asset] = await db
			.insert(schema.assets)
			.values({
				id: randomUUID(),
				folderId: folder.id,
				ownerId: userId,
				name: 'scene.glb',
				type: 'model',
				filePath: `test/${randomUUID()}.glb`,
				mimeType: 'model/gltf-binary',
				fileSize: 10
			})
			.returning({ id: schema.assets.id })
		const [scene] = await db
			.insert(schema.scenes)
			.values({ projectId: project, name: 'Rocket', status: 'published' })
			.returning({ id: schema.scenes.id })
		await db
			.insert(schema.scenePublished)
			.values({ sceneId: scene.id, assetId: asset.id, publishedBy: userId })
		return scene.id
	}

	beforeAll(async () => {
		vi.stubEnv('APPLICATION_URL', ORIGIN)
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		keysRoute =
			await import('../../app/routes/api/v1/projects.$projectId.embed-keys')
		domainsRoute =
			await import('../../app/routes/api/v1/projects.$projectId.allowed-domains')
		embedRoute = await import('../../app/routes/api/v1/scenes.$sceneId.embed')
		previewAuth =
			await import('../../app/lib/domain/auth/preview-api-key-auth.server')

		await db.insert(schema.users).values({
			id: userId,
			email: `agent-${userId}@embed.test`,
			name: 'Agent user'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `embed-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `embed-${otherOrgId}`, ownerId: userId }
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
			scopes: ['projects:read', 'embed:manage']
		})
	})

	beforeEach(async () => {
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, orgId))
		await db
			.delete(schema.agentIdempotencyKeys)
			.where(eq(schema.agentIdempotencyKeys.grantId, grantId))
		await db
			.delete(schema.apiKeys)
			.where(eq(schema.apiKeys.organizationId, orgId))
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: orgId, name: `Embed ${randomUUID()}` })
			.returning({ id: schema.projects.id })
		projectId = project.id
		sceneId = await publishedScene(projectId)
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
		await db
			.delete(schema.apiKeys)
			.where(inArray(schema.apiKeys.organizationId, [orgId, otherOrgId]))
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

	it('creates a key linked to the project, audits it, keeps no token and replays a retry', async () => {
		const first = await createKey('key-1')
		const retry = await createKey('key-1')

		expect(first.status).toBe(201)
		expect(json(retry)).toEqual(json(first))
		expect(retry.headers.get('Idempotent-Replayed')).toBe('true')

		const keys = await projectKeys()
		expect(keys).toHaveLength(1)
		const created = json(first).data.embedKey
		expect(created).toMatchObject({ id: keys[0].id, usable: true })
		expect(keys[0].encryptedKey).not.toBeNull()
		expect(await audit('api-key:create', keys[0].id)).toHaveLength(1)

		// The token is what `getSceneEmbed` hands out; neither the answer nor
		// the kept row may carry it.
		const token = new URL(
			json(await getEmbed()).data.embed.url
		).searchParams.get('token')
		expect(token).toMatch(/^vctrl_/)
		expect(first.text).not.toContain(token)
		const [kept] = await db
			.select({ body: sql<string>`${schema.agentIdempotencyKeys}::text` })
			.from(schema.agentIdempotencyKeys)
			.where(eq(schema.agentIdempotencyKeys.grantId, grantId))
		expect(kept.body).not.toContain(token)
	})

	it('answers the key limit with a kept 403 and creates nothing', async () => {
		await db.insert(schema.orgLimitOverrides).values({
			organizationId: orgId,
			limitKey: 'api_keys_per_org',
			limitValue: BigInt(0)
		})

		const refused = await createKey('limit-1')
		const replayed = await createKey('limit-1')

		expect(refused.status).toBe(403)
		expect(json(refused)).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'api_keys_per_org' }
		})
		expect(json(replayed)).toEqual(json(refused))
		expect(await projectKeys()).toEqual([])
	})

	it('sets and reads the allowed domains, normalized, and audits the change', async () => {
		const set = await setDomains('domains-1', [
			'Example.com',
			'*.myshopify.com'
		])

		expect(set.status).toBe(200)
		expect(json(set).data.allowedDomains).toEqual([
			'example.com',
			'*.myshopify.com'
		])
		expect(json(await getDomains()).data.allowedDomains).toEqual([
			'example.com',
			'*.myshopify.com'
		])
		const [project] = await db
			.select({ domains: schema.projects.allowedEmbedDomains })
			.from(schema.projects)
			.where(eq(schema.projects.id, projectId))
		expect(project.domains).toBe('example.com\n*.myshopify.com')
		expect(await audit('project-embed-domains:update', projectId)).toHaveLength(
			1
		)

		await setDomains('domains-2', [])
		expect(json(await getDomains()).data.allowedDomains).toEqual([])
	})

	it('hands out an embed URL the embed page accepts from an allowed site and refuses from another', async () => {
		await createKey('flow-1')
		await setDomains('flow-2', ['example.com'])

		const embed = await getEmbed()

		expect(embed.status).toBe(200)
		const { url, allowedDomains } = json(embed).data.embed
		expect(
			url.startsWith(`${ORIGIN}/embed/${projectId}/${sceneId}?token=`)
		).toBe(true)
		expect(allowedDomains).toEqual(['example.com'])

		const fromSite = (referer: string) =>
			previewAuth.validatePreviewApiKeyForProject({
				request: new Request(url, { headers: { referer } }),
				projectId
			})
		expect(await fromSite('https://example.com/product')).toMatchObject({
			ok: true
		})
		expect(await fromSite('https://other.test/product')).toEqual({
			ok: false,
			error: 'domain_not_allowed'
		})
	})

	it('answers 409 for a draft and for a project without a usable key', async () => {
		const noKey = await getEmbed()
		expect(noKey.status).toBe(409)
		expect(json(noKey).code).toBe('embed_key_required')

		await db
			.delete(schema.scenePublished)
			.where(eq(schema.scenePublished.sceneId, sceneId))
		const draft = await getEmbed()
		expect(draft.status).toBe(409)
		expect(json(draft).code).toBe('scene_not_published')
	})

	it('refuses a member, and an empty or unknown change, in the repository too', async () => {
		const { updateProject } =
			await import('../../app/lib/domain/project/project-repository.server')
		const [other] = await db
			.insert(schema.projects)
			.values({ organizationId: otherOrgId, name: `Member ${randomUUID()}` })
			.returning({ id: schema.projects.id })
		await db
			.update(schema.organizationMemberships)
			.set({ role: 'member' })
			.where(
				and(
					eq(schema.organizationMemberships.userId, userId),
					eq(schema.organizationMemberships.organizationId, otherOrgId)
				)
			)
		try {
			await expect(
				updateProject(other.id, { allowedEmbedDomains: 'example.com' }, userId)
			).rejects.toThrow(/allowed domains/)
			await expect(
				updateProject(other.id, { name: 'Renamed' }, userId)
			).rejects.toThrow(/edit this project/)
		} finally {
			await db
				.update(schema.organizationMemberships)
				.set({ role: 'owner' })
				.where(
					and(
						eq(schema.organizationMemberships.userId, userId),
						eq(schema.organizationMemberships.organizationId, otherOrgId)
					)
				)
		}
		await expect(updateProject(other.id, {}, userId)).rejects.toThrow(
			'Nothing to update'
		)
		await expect(
			updateProject(other.id, { organizationId: orgId } as never, userId)
		).rejects.toThrow('cannot be updated')

		const [row] = await db
			.select({
				name: schema.projects.name,
				domains: schema.projects.allowedEmbedDomains,
				organizationId: schema.projects.organizationId
			})
			.from(schema.projects)
			.where(eq(schema.projects.id, other.id))
		expect(row.domains).toBeNull()
		expect(row.name).toMatch(/^Member /)
		expect(row.organizationId).toBe(otherOrgId)
	})

	it("answers 404 for a project or scene outside the grant's organization", async () => {
		const [other] = await db
			.insert(schema.projects)
			.values({ organizationId: otherOrgId, name: `Other ${randomUUID()}` })
			.returning({ id: schema.projects.id })
		const otherScene = await publishedScene(other.id)

		expect((await createKey('other-1', 'Shop', other.id)).status).toBe(404)
		expect((await getEmbed(otherScene)).status).toBe(404)
		expect(await projectKeys(other.id)).toEqual([])
	})

	it('creates a key and sets domains on the one connection each transaction holds', async () => {
		// Every other pooled connection is held, so a write that reaches for a
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

		const starved = new Promise((resolve) =>
			setTimeout(() => resolve('starved'), 10_000)
		)
		const key = await Promise.race([
			createKey('one-connection-1').then((result) => result.status),
			starved
		])
		const domains = await Promise.race([
			setDomains('one-connection-2', ['example.com']).then(
				(result) => result.status
			),
			starved
		])
		release()
		await Promise.all(holders)

		expect(key).toBe(201)
		expect(domains).toBe(200)
	}, 30_000)
})
