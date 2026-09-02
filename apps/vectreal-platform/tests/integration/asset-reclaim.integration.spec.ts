/**
 * Asks a real Postgres whether an upload batch that never committed gets
 * reclaimed, and whether a batch that did commit is left alone.
 *
 * The safety property under test is a race, so it cannot be mocked: two flows
 * can touch the same deduplicated asset row, and the thing that keeps a reclaim
 * from deleting a live asset is `selectUnreferencedAssetIds` reading real link
 * tables plus the request-id re-stamp writing real metadata. A mocked version
 * of either proves only that the mock agrees with itself.
 *
 * Supabase Storage is faked at the `createClient` boundary. It is the one step
 * that leaves Postgres, and none of the behaviour here depends on bytes
 * actually moving.
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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const removedPaths: string[] = []

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				upload: async (path: string) => ({ data: { path }, error: null }),
				remove: async (paths: string[]) => {
					removedPaths.push(...paths)
					return { data: null, error: null }
				}
			})
		}
	})
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Reclaim = typeof import('../../app/lib/domain/asset/asset-reclaim.server')
type Storage = typeof import('../../app/lib/domain/asset/asset-storage.server')

describe('asset reclaim', () => {
	let schema: Schema
	let db: Db
	let reclaimUploadBatch: Reclaim['reclaimUploadBatch']
	let reclaimStaleProjectAssets: Reclaim['reclaimStaleProjectAssets']
	let uploadSceneAssets: Storage['uploadSceneAssets']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	/** An upload row exactly as `uploadSceneAssets` writes one. */
	const seedAsset = async (opts: {
		requestId?: string
		createdAt?: Date
		name?: string
	}) => {
		const assetId = randomUUID()
		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name: opts.name ?? `${assetId}.bin`,
			type: 'model',
			filePath: `scenes/${randomUUID()}/assets/${assetId}/blob.bin`,
			ownerId,
			metadata: { requestId: opts.requestId, contentHash: 'seeded' },
			...(opts.createdAt ? { createdAt: opts.createdAt } : {})
		})
		return assetId
	}

	const exists = async (assetId: string) => {
		const rows = await db
			.select({ id: schema.assets.id })
			.from(schema.assets)
			.where(eq(schema.assets.id, assetId))
		return rows.length === 1
	}

	beforeAll(async () => {
		process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
		process.env.SUPABASE_SECRET_KEY ??= 'integration-test-key'

		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ reclaimUploadBatch, reclaimStaleProjectAssets } =
			await import('../../app/lib/domain/asset/asset-reclaim.server'))
		;({ uploadSceneAssets } =
			await import('../../app/lib/domain/asset/asset-storage.server'))

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

	it('collects an upload the commit never linked', async () => {
		const requestId = randomUUID()
		const stranded = await seedAsset({ requestId })

		const collected = await reclaimUploadBatch({ requestId, projectId })

		expect(collected).toEqual([stranded])
		expect(await exists(stranded)).toBe(false)
	})

	it('keeps the assets the commit did link', async () => {
		const requestId = randomUUID()
		const linked = await seedAsset({ requestId })
		const stranded = await seedAsset({ requestId })

		const collected = await reclaimUploadBatch({
			requestId,
			projectId,
			keepAssetIds: [linked]
		})

		expect(collected).toEqual([stranded])
		expect(await exists(linked)).toBe(true)

		await db.delete(schema.assets).where(eq(schema.assets.id, linked))
	})

	it('keeps an asset another scene already references', async () => {
		// The dedupe folder is per project, so a batch's row can be one a
		// different scene is already published from. Being absent from this
		// batch's commit does not make it garbage.
		const requestId = randomUUID()
		const shared = await seedAsset({ requestId })
		// A control in the same scope. Without it an empty result would also be
		// what a dead candidate query or a swallowed throw returns, and this test
		// would pass having never reached the reference check.
		const control = await seedAsset({ requestId })
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'other' })
		await db.insert(schema.scenePublished).values({
			sceneId,
			assetId: shared,
			publishedBy: ownerId
		})

		const collected = await reclaimUploadBatch({ requestId, projectId })

		expect(collected).toEqual([control])
		expect(await exists(shared)).toBe(true)

		await db.delete(schema.assets).where(eq(schema.assets.id, shared))
	})

	it('does nothing when the flow sent no request id', async () => {
		// This row would be collected by any scope that reached it, so a green
		// result means the missing id stopped the reclaim rather than the query
		// finding nothing.
		const orphan = await seedAsset({ requestId: randomUUID() })

		expect(
			await reclaimUploadBatch({ requestId: undefined, projectId })
		).toEqual([])
		expect(await exists(orphan)).toBe(true)

		await db.delete(schema.assets).where(eq(schema.assets.id, orphan))
	})

	it('does not hand an in-flight row to a second batch', async () => {
		// The property that makes the reclaim safe without any timing
		// assumption. Batch one's row is not referenced yet, so batch two must
		// create its own rather than share it - otherwise whichever batch failed
		// first would delete an asset the other was about to link, and no grace
		// window would help, because the two overlap for as long as the slower
		// one runs.
		const firstBatch = randomUUID()
		const secondBatch = randomUUID()
		const bytes = new Uint8Array([1, 2, 3, 4, 5])
		const upload = (requestId: string) =>
			uploadSceneAssets(
				randomUUID(),
				ownerId,
				projectId,
				[
					{
						fileName: 'shared.bin',
						data: bytes,
						mimeType: 'application/octet-stream',
						type: 'buffer'
					}
				],
				requestId
			)

		const [first] = await upload(firstBatch)
		const [second] = await upload(secondBatch)

		expect(second.assetId).not.toBe(first.assetId)

		// Batch two failing therefore cannot touch batch one's row.
		const collected = await reclaimUploadBatch({
			requestId: secondBatch,
			projectId
		})

		expect(collected).toEqual([second.assetId])
		expect(await exists(first.assetId)).toBe(true)

		await db.delete(schema.assets).where(eq(schema.assets.id, first.assetId))
	})

	it('sweeps an unreferenced asset once it is older than the grace window', async () => {
		const fresh = await seedAsset({ requestId: randomUUID() })
		const stale = await seedAsset({
			requestId: randomUUID(),
			createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
		})

		const collected = await reclaimStaleProjectAssets({ projectId })

		// Set-wise: the sweep's query has no total order, and any row another
		// test left behind would otherwise make this a brittle list comparison.
		expect(collected).toContain(stale)
		expect(collected).not.toContain(fresh)
		expect(await exists(stale)).toBe(false)
		expect(await exists(fresh)).toBe(true)

		await db.delete(schema.assets).where(eq(schema.assets.id, fresh))
	})

	it('reclaims the batch when the save operation itself is rejected', async () => {
		// The premise of this whole module, and the one path that was never
		// exercised: uploads land in their own requests, so a commit rejected
		// afterwards leaves them linked to nothing. Driving the real operation
		// rather than `reclaimUploadBatch` directly is the point - it proves the
		// call site exists and runs on the failure path.
		const { saveSceneSettings } =
			await import('../../app/lib/domain/scene/server/scene-settings.operations.server')

		const requestId = randomUUID()
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'rejected' })
		const stranded = await seedAsset({ requestId })

		// `sceneAssetIds` names an asset that does not exist, so
		// `assertAssetsBelongToProject` throws after the uploads are already
		// persisted - the shape of a quota or entitlement rejection.
		const response = await saveSceneSettings(
			{
				action: 'commit-scene-save',
				requestId,
				sceneId,
				projectId,
				meta: {},
				settings: {},
				sceneAssetIds: [randomUUID()]
			} as never,
			ownerId
		)

		expect(response.ok).toBe(false)
		expect(await exists(stranded)).toBe(false)
	})

	it('reaches an orphan sitting behind a page of referenced rows', async () => {
		// The bound has to be applied to rows already known unreferenced. A
		// healthy project's oldest assets belong to its longest-lived scene and
		// stay referenced forever, so a page taken before the reference test
		// would return the same referenced prefix on every save and never reach
		// anything collectable.
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'long-lived' })
		const settingsId = randomUUID()
		await db
			.insert(schema.sceneSettings)
			.values({ id: settingsId, sceneId, createdBy: ownerId })

		const old = new Date(Date.now() - 72 * 60 * 60 * 1000)
		for (let i = 0; i < 4; i += 1) {
			const referenced = await seedAsset({
				requestId: randomUUID(),
				createdAt: old
			})
			await db
				.insert(schema.sceneAssets)
				.values({ sceneSettingsId: settingsId, assetId: referenced })
		}

		// Newer than every referenced row, so a page ordered oldest-first would
		// be entirely filled by them.
		const buried = await seedAsset({
			requestId: randomUUID(),
			createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
		})

		const collected = await reclaimStaleProjectAssets({ projectId, limit: 4 })

		expect(collected).toContain(buried)
		expect(await exists(buried)).toBe(false)
	})

	it('agrees with the id-list reference check', async () => {
		// Two queries answering one question. They are only allowed to disagree
		// by never disagreeing: a folder-scoped collector that forgot the
		// thumbnail path is what deleted live scene thumbnails once already.
		const sceneId = randomUUID()
		const thumbAsset = await seedAsset({ requestId: randomUUID() })
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'thumbnailed',
			thumbnailUrl: `/api/scenes/${sceneId}/thumbnail/${thumbAsset}`
		})
		const plainOrphan = await seedAsset({ requestId: randomUUID() })

		const { selectUnreferencedAssetIdsInFolder, selectUnreferencedAssetIds } =
			await import('../../app/lib/domain/asset/asset-storage.server')

		const byFolder = await selectUnreferencedAssetIdsInFolder({
			folderId: assetFolderId,
			createdBefore: new Date(Date.now() + 60_000),
			limit: 500
		})
		const byIds = await selectUnreferencedAssetIds([thumbAsset, plainOrphan])

		expect(byFolder).not.toContain(thumbAsset)
		expect(byIds).not.toContain(thumbAsset)
		expect(byFolder).toContain(plainOrphan)
		expect(byIds).toContain(plainOrphan)

		await db.delete(schema.assets).where(eq(schema.assets.id, plainOrphan))
	})

	it('swallows a failure in its own candidate lookup', async () => {
		// These run after the save or publish has committed, and one runs from a
		// `finally`, where a throw discards the pending return and turns a landed
		// publish into a 500 with its idempotency record stuck pending. A broken
		// project id makes the lookup itself throw, which is the half that used
		// to sit outside the guard.
		await expect(
			reclaimUploadBatch({ requestId: randomUUID(), projectId: 'not-a-uuid' })
		).resolves.toEqual([])

		await expect(
			reclaimStaleProjectAssets({ projectId: 'not-a-uuid' })
		).resolves.toEqual([])
	})

	it('removes the storage object alongside the row', async () => {
		const requestId = randomUUID()
		const stranded = await seedAsset({ requestId })
		const [row] = await db
			.select({ filePath: schema.assets.filePath })
			.from(schema.assets)
			.where(eq(schema.assets.id, stranded))

		removedPaths.length = 0
		await reclaimUploadBatch({ requestId, projectId })

		expect(removedPaths).toContain(row.filePath)
	})
})
