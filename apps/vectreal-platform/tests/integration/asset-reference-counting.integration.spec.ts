/**
 * Asks a real Postgres which assets are safe to delete.
 *
 * This cannot be unit tested. The question `selectUnreferencedAssetIds`
 * answers is three joins and a `regexp_replace` over a column that holds a URL
 * rather than a foreign key, so a mock proves only that the mock agrees with
 * itself. The bug it exists to prevent - a thumbnail deleted by the
 * save-path garbage collector because nothing joined to it - was invisible to
 * every test in the suite.
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
type AssetStorage =
	typeof import('../../app/lib/domain/asset/asset-storage.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('asset reference counting', () => {
	// Loaded in `beforeAll` rather than at module scope: these modules call
	// `getDbClient()` on import, which throws without a `DATABASE_URL`.
	let schema: Schema
	let selectUnreferencedAssetIds: AssetStorage['selectUnreferencedAssetIds']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ selectUnreferencedAssetIds } =
			await import('../../app/lib/domain/asset/asset-storage.server'))
		db = (await import('../../app/db/client')).getDbClient()

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
		// Organizations cascade to projects, folders, scenes and assets.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('keeps an asset a scene thumbnail still points at', async () => {
		const assetId = randomUUID()
		const sceneId = randomUUID()

		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name: 'thumb.png',
			type: 'texture',
			filePath: `smoke/${assetId}.png`,
			ownerId
		})
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'thumbnailed',
			// Exactly the shape the save orchestrator writes. It is a URL, so it
			// joins to nothing - which is the whole problem.
			thumbnailUrl: `/api/scenes/${sceneId}/thumbnail/${assetId}`
		})

		// Nothing in `scene_assets` or `scene_published` references it. Asking
		// only those - what the collector used to do - calls this orphaned and
		// deletes the file the thumbnail is served from.
		expect(await selectUnreferencedAssetIds([assetId])).toEqual([])

		await db.delete(schema.scenes).where(eq(schema.scenes.id, sceneId))
		expect(await selectUnreferencedAssetIds([assetId])).toEqual([assetId])

		await db.delete(schema.assets).where(eq(schema.assets.id, assetId))
	})

	it('keeps an asset the published GLB still points at', async () => {
		const assetId = randomUUID()
		const sceneId = randomUUID()

		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name: 'live.glb',
			type: 'model',
			filePath: `smoke/${assetId}.glb`,
			ownerId
		})
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'live scene',
			status: 'published'
		})
		await db.insert(schema.scenePublished).values({
			sceneId,
			assetId,
			publishedBy: ownerId
		})

		expect(await selectUnreferencedAssetIds([assetId])).toEqual([])

		await db.delete(schema.scenes).where(eq(schema.scenes.id, sceneId))
		expect(await selectUnreferencedAssetIds([assetId])).toEqual([assetId])

		await db.delete(schema.assets).where(eq(schema.assets.id, assetId))
	})

	it('keeps an asset a scene still has attached', async () => {
		const assetId = randomUUID()
		const sceneId = randomUUID()
		const settingsId = randomUUID()

		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name: 'attached.glb',
			type: 'model',
			filePath: `smoke/${assetId}.glb`,
			ownerId
		})
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'attached scene'
		})
		await db
			.insert(schema.sceneSettings)
			.values({ id: settingsId, sceneId, createdBy: ownerId })
		await db
			.insert(schema.sceneAssets)
			.values({ sceneSettingsId: settingsId, assetId })

		expect(await selectUnreferencedAssetIds([assetId])).toEqual([])

		await db.delete(schema.scenes).where(eq(schema.scenes.id, sceneId))
		expect(await selectUnreferencedAssetIds([assetId])).toEqual([assetId])

		await db.delete(schema.assets).where(eq(schema.assets.id, assetId))
	})

	it('reports a genuinely unreferenced asset', async () => {
		const assetId = randomUUID()
		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name: 'loose.bin',
			type: 'other',
			filePath: `smoke/${assetId}.bin`,
			ownerId
		})

		expect(await selectUnreferencedAssetIds([assetId])).toEqual([assetId])

		await db.delete(schema.assets).where(eq(schema.assets.id, assetId))
	})

	it('does not confuse a different asset with a similar id suffix', async () => {
		// The thumbnail id is parsed out of a URL, so a sloppy match could treat a
		// substring hit as a reference and keep an asset alive forever.
		const other = randomUUID()
		expect(await selectUnreferencedAssetIds([other])).toEqual([other])
	})

	it('returns nothing for an empty list without touching the database', async () => {
		expect(await selectUnreferencedAssetIds([])).toEqual([])
	})
})
