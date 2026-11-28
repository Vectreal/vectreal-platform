/**
 * Asks a real Postgres which size the dashboard's opening fact sums.
 *
 * The saving it reports is what visitors no longer download, so the current
 * size is the published GLB as stored. `scene_stats.current_scene_bytes` is a
 * copy that saves before #1047 overwrote, and it is seeded stale here to prove
 * the sum reads the file.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Facts =
	typeof import('../../app/lib/domain/dashboard/dashboard-facts-repository.server')

describe('dashboard facts', () => {
	let schema: Schema
	let db: Db
	let getDashboardFactsForUser: Facts['getDashboardFactsForUser']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ getDashboardFactsForUser } =
			await import('../../app/lib/domain/dashboard/dashboard-facts-repository.server'))

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
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('leaves out a scene that is not published, whatever its column says', async () => {
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'revoked' })
		await db.insert(schema.sceneStats).values({
			sceneId,
			createdBy: ownerId,
			initialSceneBytes: 9_000_000,
			currentSceneBytes: 1_000
		})

		const facts = await getDashboardFactsForUser(ownerId)

		expect(facts.measuredSceneCount).toBe(0)
		expect(facts.currentBytes).toBe(0)
		expect(facts.biggestCut).toBeNull()
	})

	it('sums the published file, not the copied column', async () => {
		const sceneId = randomUUID()
		const assetId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'drifted' })
		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name: 'scene.glb',
			type: 'model',
			filePath: `smoke/${assetId}/scene.glb`,
			fileSize: 2_838_952,
			ownerId
		})
		await db
			.insert(schema.scenePublished)
			.values({ sceneId, assetId, publishedBy: ownerId })
		await db.insert(schema.sceneStats).values({
			sceneId,
			createdBy: ownerId,
			initialSceneBytes: 33_916_872,
			currentSceneBytes: 863_984
		})

		const facts = await getDashboardFactsForUser(ownerId)

		expect(facts.currentBytes).toBe(2_838_952)
		expect(facts.biggestCut).toEqual({
			sceneName: 'drifted',
			initialBytes: 33_916_872,
			currentBytes: 2_838_952
		})
	})
})
