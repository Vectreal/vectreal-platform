/**
 * `GET` and `PATCH /api/v1/scenes/:sceneId/settings` against real tables:
 * the routes with only the token check and storage replaced, so the write
 * lock, the idempotency key, the settings save, the asset links and the audit
 * row all run as they do in production. Scenes are made through the create
 * route, so they start as an agent's scene really does.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { and, count, eq, inArray } from 'drizzle-orm'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

import {
	defaultEnvOptions,
	normalizeShadowOptions
} from '../../app/constants/viewer-defaults'

import type { AgentActor } from '../../app/lib/domain/agent/agent-actor.server'

const { authorizeAgentRequest, storage } = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	storage: { removed: [] as string[] }
}))

vi.mock('../../app/lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))
vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				upload: async (path: string) => ({ data: { path }, error: null }),
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
type CreateRoute =
	typeof import('../../app/routes/api/v1/projects.$projectId.scenes')
type SettingsRoute =
	typeof import('../../app/routes/api/v1/scenes.$sceneId.settings')
type Guard =
	typeof import('../../app/lib/domain/scene/server/scene-action-guard.server')

const BOX = new Uint8Array(
	readFileSync(
		join(
			import.meta.dirname,
			'../../../..',
			'packages/viewer-e2e/src/consumer-template/public/box.glb'
		)
	)
)

describe('/api/v1/scenes/:sceneId/settings', () => {
	let schema: Schema
	let db: Db
	let createRoute: CreateRoute
	let settingsRoute: SettingsRoute
	let guard: Guard

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
		scopes: ['projects:read', 'projects:write', 'scenes:write']
	}

	const answer = async (work: Promise<Response>) => {
		// The routes throw refusals; read them like the framework does.
		const response = await work.catch((error: unknown) => {
			if (error instanceof Response) return error
			throw error
		})
		return {
			status: response.status,
			headers: response.headers,
			body: await response.json()
		}
	}

	const patch = (body: unknown, key = randomUUID(), scene = sceneId) =>
		answer(
			settingsRoute.action({
				request: new Request(
					`https://vectreal.com/api/v1/scenes/${scene}/settings`,
					{
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json',
							'Idempotency-Key': `"${key}"`
						},
						body: JSON.stringify(body)
					}
				),
				params: { sceneId: scene },
				context: {}
			} as never)
		)

	const get = (scene = sceneId) =>
		answer(
			settingsRoute.loader({
				request: new Request(
					`https://vectreal.com/api/v1/scenes/${scene}/settings`
				),
				params: { sceneId: scene },
				context: {}
			} as never)
		)

	const settingsRow = async () => {
		const [row] = await db
			.select()
			.from(schema.sceneSettings)
			.where(eq(schema.sceneSettings.sceneId, sceneId))
		return row
	}
	const links = async () =>
		(
			await db
				.select({ assetId: schema.sceneAssets.assetId })
				.from(schema.sceneAssets)
				.where(eq(schema.sceneAssets.sceneSettingsId, (await settingsRow()).id))
		)
			.map((link) => link.assetId)
			.sort()
	const sceneRow = async () => {
		const [row] = await db
			.select()
			.from(schema.scenes)
			.where(eq(schema.scenes.id, sceneId))
		return row
	}
	const audits = async () => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.agentAuditEvents)
			.where(
				and(
					eq(schema.agentAuditEvents.targetId, sceneId),
					eq(schema.agentAuditEvents.operation, 'scene:update')
				)
			)
		return row.total
	}

	beforeAll(async () => {
		vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:1')
		vi.stubEnv('SUPABASE_SECRET_KEY', 'test')
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		createRoute =
			await import('../../app/routes/api/v1/projects.$projectId.scenes')
		settingsRoute =
			await import('../../app/routes/api/v1/scenes.$sceneId.settings')
		guard =
			await import('../../app/lib/domain/scene/server/scene-action-guard.server')

		await db.insert(schema.users).values({
			id: userId,
			email: `agent-${userId}@settings.test`,
			name: 'Agent user'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `settings-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `settings-${otherOrgId}`, ownerId: userId }
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
			scopes: actor.scopes
		})
	})

	beforeEach(async () => {
		storage.removed.length = 0
		authorizeAgentRequest.mockResolvedValue(actor)
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: orgId, name: `Settings ${randomUUID()}` })
			.returning({ id: schema.projects.id })
		projectId = project.id

		const form = new FormData()
		form.set('name', 'Box')
		form.set('file', new Blob([BOX]))
		const created = await answer(
			createRoute.action({
				request: new Request(
					`https://vectreal.com/api/v1/projects/${projectId}/scenes`,
					{
						method: 'POST',
						headers: { 'Idempotency-Key': `"${randomUUID()}"` },
						body: form
					}
				),
				params: { projectId },
				context: {}
			} as never)
		)
		expect(created.status).toBe(201)
		sceneId = created.body.data.scene.id
	})

	afterAll(async () => {
		await db
			.delete(schema.agentAuditEvents)
			.where(eq(schema.agentAuditEvents.userId, userId))
		await db
			.delete(schema.agentIdempotencyKeys)
			.where(eq(schema.agentIdempotencyKeys.grantId, grantId))
		await db
			.delete(schema.agentGrants)
			.where(eq(schema.agentGrants.userId, userId))
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

	it('changes only the sections sent, keeps the name and every link, moves updatedAt, audits once and replays a retry', async () => {
		const linksBefore = await links()
		const sceneBefore = await sceneRow()
		const key = randomUUID()
		const body = {
			environment: {
				preset: 'night-city',
				files: 'https://attacker.example/x.hdr'
			}
		}

		const first = await patch(body, key)
		const replay = await patch(body, key)

		expect(first.status).toBe(200)
		// Filled over the defaults, and `files` dropped.
		expect(first.body.data.settings.environment).toEqual({
			...defaultEnvOptions,
			preset: 'night-city'
		})
		expect((await settingsRow()).environment).toEqual({
			...defaultEnvOptions,
			preset: 'night-city'
		})
		expect(await links()).toEqual(linksBefore)
		const sceneAfter = await sceneRow()
		expect(sceneAfter.name).toBe(sceneBefore.name)
		expect(sceneAfter.updatedAt.getTime()).toBeGreaterThan(
			sceneBefore.updatedAt.getTime()
		)
		expect(replay.status).toBe(200)
		expect(replay.headers.get('Idempotent-Replayed')).toBe('true')
		expect(await audits()).toBe(1)

		const read = await get()
		expect(read.body.data.settings.environment).toEqual({
			...defaultEnvOptions,
			preset: 'night-city'
		})
	})

	it('keeps a stored bake and its link when shadows are sent, and removes no file', async () => {
		const [bakeAsset] = await db
			.select({ id: schema.assets.id, folderId: schema.assets.folderId })
			.from(schema.assets)
			.where(inArray(schema.assets.id, await links()))
			.limit(1)
		const [bake] = await db
			.insert(schema.assets)
			.values({
				id: randomUUID(),
				folderId: bakeAsset.folderId,
				ownerId: userId,
				name: 'shadow-bake.png',
				type: 'other',
				mimeType: 'image/png',
				filePath: `bakes/${randomUUID()}.png`,
				fileSize: 4
			})
			.returning({ id: schema.assets.id, filePath: schema.assets.filePath })
		const row = await settingsRow()
		await db
			.insert(schema.sceneAssets)
			.values({ sceneSettingsId: row.id, assetId: bake.id })
		await db
			.update(schema.sceneSettings)
			.set({
				shadows: {
					...row.shadows,
					baked: { assetId: bake.id, signature: 'sig' }
				}
			})
			.where(eq(schema.sceneSettings.id, row.id))

		const response = await patch({
			shadows: {
				enabled: true,
				baked: { assetId: randomUUID(), signature: 'x' }
			}
		})

		expect(response.status).toBe(200)
		expect((await settingsRow()).shadows).toEqual({
			...normalizeShadowOptions({ enabled: true }),
			baked: { assetId: bake.id, signature: 'sig' }
		})
		expect(await links()).toContain(bake.id)
		expect(storage.removed).toEqual([])
	})

	it('resets a stored presentation to the defaults when an empty one is sent', async () => {
		const row = await settingsRow()
		await db
			.update(schema.sceneSettings)
			.set({ presentation: { showInfoPopover: false } })
			.where(eq(schema.sceneSettings.id, row.id))

		const response = await patch({ presentation: {} })

		expect(response.status).toBe(200)
		expect((await settingsRow()).presentation).toEqual({
			showInfoPopover: true,
			showLoadingThumbnail: false
		})
	})

	it('answers 409 scene_busy while another save holds the scene, and changes nothing', async () => {
		expect(
			await guard.acquireSceneWriteLock({ sceneId, holderKey: 'publisher' })
		).toBe(true)
		try {
			const response = await patch({ controls: { autoRotate: true } })

			expect(response.status).toBe(409)
			expect(response.body.code).toBe('scene_busy')
			expect((await settingsRow()).controls).not.toMatchObject({
				autoRotate: true
			})
		} finally {
			await guard.releaseSceneWriteLock({ sceneId, holderKey: 'publisher' })
		}
	})

	it('answers 404 for a scene in another organization of the same user', async () => {
		authorizeAgentRequest.mockResolvedValue({
			...actor,
			organizationId: otherOrgId
		})

		expect((await get()).status).toBe(404)
		expect((await patch({ controls: {} })).status).toBe(404)
	})
})
