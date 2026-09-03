/**
 * Asks a real Postgres whether the storage allowance refuses the bytes it
 * should and lets through the bytes it should.
 *
 * `storage_bytes_total` was enforced once before, in `prepareSceneUpload`,
 * against the scene size the client reported. That figure already included the
 * scene being saved, and the organization sum it was compared to included it
 * too, so every update charged the same bytes twice and an organization near
 * its limit was refused a save that added nothing. It also never ran for the
 * three actions that write bytes.
 *
 * The guard lives at the single insert site now, where the lengths are the
 * server's own and the content hash already says which bytes are new. That is
 * what the third test below is for: a re-save of unchanged assets has to pass
 * with the organization sitting exactly on its limit.
 *
 * Storage is faked at the `createClient` boundary; nothing here depends on
 * bytes actually moving.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				upload: async (path: string) => ({ data: { path }, error: null }),
				remove: async () => ({ data: null, error: null })
			})
		}
	})
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Storage = typeof import('../../app/lib/domain/asset/asset-storage.server')

describe('the storage allowance, at the place bytes become rows', () => {
	let schema: Schema
	let db: Db
	let uploadSceneAssets: Storage['uploadSceneAssets']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()

	const bytes = (size: number, seed: number) =>
		Uint8Array.from({ length: size }, (_, i) => (i + seed) % 251)

	const upload = (fileName: string, data: Uint8Array) =>
		uploadSceneAssets(
			randomUUID(),
			ownerId,
			projectId,
			[
				{ fileName, data, mimeType: 'application/octet-stream', type: 'buffer' }
			],
			randomUUID()
		)

	/**
	 * Links an asset to a throwaway scene. Reuse is only offered for rows
	 * something already references, so without this a second upload of the same
	 * bytes would write a new row and the reuse tests would prove nothing.
	 */
	const reference = async (assetId: string) => {
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: `s-${sceneId}` })
		const settingsId = randomUUID()
		await db
			.insert(schema.sceneSettings)
			.values({ id: settingsId, sceneId, createdBy: ownerId })
		await db
			.insert(schema.sceneAssets)
			.values({ sceneSettingsId: settingsId, assetId })
	}

	const storedBytes = async () => {
		const rows = await db
			.select({ fileSize: schema.assets.fileSize })
			.from(schema.assets)
			.innerJoin(schema.folders, eq(schema.folders.id, schema.assets.folderId))
			.where(eq(schema.folders.projectId, projectId))
		return rows.reduce((total, row) => total + (row.fileSize ?? 0), 0)
	}

	const assetCount = async () => (await storedRows()).length
	const storedRows = async () =>
		db
			.select({ id: schema.assets.id })
			.from(schema.assets)
			.innerJoin(schema.folders, eq(schema.folders.id, schema.assets.folderId))
			.where(eq(schema.folders.projectId, projectId))
	const folderCount = async () =>
		(
			await db
				.select({ id: schema.folders.id })
				.from(schema.folders)
				.where(eq(schema.folders.projectId, projectId))
		).length

	const setStorageLimit = async (value: number) => {
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, organizationId))
		await db.insert(schema.orgLimitOverrides).values({
			organizationId,
			limitKey: 'storage_bytes_total',
			limitValue: BigInt(value)
		})
	}

	beforeAll(async () => {
		process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
		process.env.SUPABASE_SECRET_KEY ??= 'integration-test-key'

		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ uploadSceneAssets } =
			await import('../../app/lib/domain/asset/asset-storage.server'))

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@quota.test`,
			name: 'Owner'
		})
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `quota-${organizationId}`, ownerId })
		await db
			.insert(schema.organizationMemberships)
			.values({ userId: ownerId, organizationId, role: 'owner' })
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Quota project',
			slug: `quota-${projectId}`
		})
	})

	beforeEach(async () => {
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, organizationId))
	})

	afterAll(async () => {
		if (!db) return
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, organizationId))
		await db
			.delete(schema.projects)
			.where(eq(schema.projects.organizationId, organizationId))
		await db
			.delete(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.organizationId, organizationId))
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(inArray(schema.users.id, [ownerId]))
	})

	it('refuses bytes that would take the organization past its allowance, and writes nothing', async () => {
		const before = await assetCount()
		await setStorageLimit(500)

		await expect(upload('too-big.bin', bytes(900, 1))).rejects.toThrow(
			/Storage limit reached/
		)

		expect(await assetCount()).toBe(before)
		/*
		  The folder counts as a write too. Reuse resolution used to create it
		  ahead of the guard, so a refused request left a row behind and "writes
		  nothing" held only for the assets.
		*/
		expect(await folderCount()).toBe(0)
	})

	it('lets bytes through while the allowance has room', async () => {
		await setStorageLimit(10_000)

		const [result] = await upload('within.bin', bytes(400, 2))
		expect(result.assetId).toBeTruthy()
		await reference(result.assetId)
	})

	it('charges nothing for a re-save of unchanged assets, at exactly the limit', async () => {
		/*
		  The regression this whole change exists for. The organization sum already
		  contains these bytes, so charging them again refuses a save that adds
		  none - and the client sends the scene id and its size together on every
		  save, so it fires on ordinary edits, not edge cases.
		*/
		await setStorageLimit(10_000)
		const sameBytes = bytes(700, 3)
		const [first] = await upload('unchanged.bin', sameBytes)
		await reference(first.assetId)

		const total = await storedBytes()
		await setStorageLimit(total)

		const [again] = await upload('unchanged.bin', sameBytes)
		expect(again.assetId).toBe(first.assetId)
	})

	it('charges only the new bytes in a batch that also reuses', async () => {
		await setStorageLimit(10_000)
		const reused = bytes(600, 4)
		const [existing] = await upload('reused.bin', reused)
		await reference(existing.assetId)

		const before = await storedBytes()
		// Room for the new file alone, not for the new file plus the reused one.
		await setStorageLimit(before + 300)

		const results = await uploadSceneAssets(
			randomUUID(),
			ownerId,
			projectId,
			[
				{
					fileName: 'reused.bin',
					data: reused,
					mimeType: 'application/octet-stream',
					type: 'buffer'
				},
				{
					fileName: 'fresh.bin',
					data: bytes(250, 5),
					mimeType: 'application/octet-stream',
					type: 'buffer'
				}
			],
			randomUUID()
		)

		expect(results).toHaveLength(2)
		expect(results[0].assetId).toBe(existing.assetId)
		/*
		  Both halves, or a regression that reused the second entry as well would
		  return two results, skip the quota block entirely and still pass.
		*/
		expect(results[1].assetId).not.toBe(existing.assetId)
		expect(await storedBytes()).toBe(before + 250)
	})
})
