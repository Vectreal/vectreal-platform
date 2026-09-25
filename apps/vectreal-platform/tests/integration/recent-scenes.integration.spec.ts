/**
 * The recent scenes a user is offered, against real rows.
 *
 * The publisher's empty stage lists them, and the dashboard does too, from the
 * same query. RLS is inert for app traffic, so the only thing keeping someone
 * else's scene, thumbnail and name, off that list is the query's membership
 * join. Only a real database shows that it holds.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type SceneRepo =
	typeof import('../../app/lib/domain/scene/server/scene-folder-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('recent scenes for a user', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let getRecentScenesForUser: SceneRepo['getRecentScenesForUser']
	let db: Db

	const memberId = randomUUID()
	const strangerId = randomUUID()
	const memberOrgId = randomUUID()
	const strangerOrgId = randomUUID()
	const memberProjectId = randomUUID()
	const strangerProjectId = randomUUID()

	const oldest = randomUUID()
	const middle = randomUUID()
	const newest = randomUUID()
	const strangers = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ getRecentScenesForUser } =
			await import('../../app/lib/domain/scene/server/scene-folder-repository.server'))
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values([
			{ id: memberId, email: `member-${memberId}@smoke.test`, name: 'Member' },
			{
				id: strangerId,
				email: `stranger-${strangerId}@smoke.test`,
				name: 'Stranger'
			}
		])
		await db.insert(schema.organizations).values([
			{ id: memberOrgId, name: `smoke-${memberOrgId}`, ownerId: memberId },
			{ id: strangerOrgId, name: `smoke-${strangerOrgId}`, ownerId: strangerId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId: memberId, organizationId: memberOrgId, role: 'owner' },
			{ userId: strangerId, organizationId: strangerOrgId, role: 'owner' }
		])
		await db.insert(schema.projects).values([
			{
				id: memberProjectId,
				organizationId: memberOrgId,
				name: 'Shop',
				slug: `smoke-${memberProjectId}`
			},
			{
				id: strangerProjectId,
				organizationId: strangerOrgId,
				name: 'Elsewhere',
				slug: `smoke-${strangerProjectId}`
			}
		])
		// The stranger's scene is the newest of all, so ordering alone cannot hide it.
		await db.insert(schema.scenes).values([
			{
				id: oldest,
				projectId: memberProjectId,
				name: 'Oldest',
				updatedAt: new Date('2026-09-01T00:00:00Z')
			},
			{
				id: middle,
				projectId: memberProjectId,
				name: 'Middle',
				updatedAt: new Date('2026-09-10T00:00:00Z')
			},
			{
				id: newest,
				projectId: memberProjectId,
				name: 'Newest',
				updatedAt: new Date('2026-09-20T00:00:00Z')
			},
			{
				id: strangers,
				projectId: strangerProjectId,
				name: 'Not yours',
				updatedAt: new Date('2026-09-25T00:00:00Z')
			}
		])
	})

	afterAll(async () => {
		// Organizations cascade to projects and scenes.
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, [memberOrgId, strangerOrgId]))
		await db.delete(schema.users).where(eq(schema.users.id, memberId))
		await db.delete(schema.users).where(eq(schema.users.id, strangerId))
	})

	it('lists only scenes in the user’s own organizations, newest first', async () => {
		const scenes = await getRecentScenesForUser(memberId, 5)

		expect(scenes.map((scene) => scene.id)).toEqual([newest, middle, oldest])
		expect(scenes[0]).toMatchObject({ name: 'Newest', projectName: 'Shop' })
	})

	it('stops at the limit it is given', async () => {
		const scenes = await getRecentScenesForUser(memberId, 2)

		expect(scenes.map((scene) => scene.id)).toEqual([newest, middle])
	})
})
