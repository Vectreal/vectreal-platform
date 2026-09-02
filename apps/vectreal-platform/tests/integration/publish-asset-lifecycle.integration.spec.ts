/**
 * Asks a real Postgres whether revoking a publish collects the right asset.
 *
 * This is a reference-counting question, and reference counting is three joins
 * over a column that holds a URL rather than a foreign key. A mocked
 * `selectUnreferencedAssetIds` would only prove the mock agrees with itself, so
 * it runs for real against the local database.
 *
 * `deleteAssets` is spied rather than executed: it is the one step that leaves
 * Postgres for Supabase Storage, and what these tests need to observe is which
 * ids the service decides to hand it.
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
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

const deleteAssetsSpy = vi.fn()

// Partial mock: the reference-counting query stays real, only the storage
// round trip is replaced.
vi.mock(
	'../../app/lib/domain/asset/asset-storage.server',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../app/lib/domain/asset/asset-storage.server')
			>()
		return { ...actual, deleteAssets: deleteAssetsSpy }
	}
)

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Service =
	typeof import('../../app/lib/domain/scene/server/scene-settings-service.server')

describe('publish revocation', () => {
	let schema: Schema
	let db: Db
	let sceneSettingsService: Service['sceneSettingsService']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	const makeAsset = async (name: string) => {
		const assetId = randomUUID()
		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name,
			type: 'model',
			filePath: `smoke/${assetId}/${name}`,
			ownerId
		})
		return assetId
	}

	const makeScene = async (name: string) => {
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name })
		return sceneId
	}

	const publishRow = async (sceneId: string, assetId: string) => {
		await db.insert(schema.scenePublished).values({
			sceneId,
			assetId,
			publishedBy: ownerId
		})
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ sceneSettingsService } =
			await import('../../app/lib/domain/scene/server/scene-settings-service.server'))

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

	beforeEach(() => {
		deleteAssetsSpy.mockClear()
	})

	it('leaves a revoked GLB alone while another scene still publishes it', async () => {
		// Content-addressed uploads dedupe per project, so two scenes publishing
		// identical bytes share one asset row. `scene_published.asset_id` is
		// ON DELETE CASCADE, so deleting it here would take the other scene's
		// publish row with it.
		const sharedAssetId = await makeAsset('shared.glb')
		const revokedScene = await makeScene('revoked')
		const survivingScene = await makeScene('surviving')

		await publishRow(revokedScene, sharedAssetId)
		await publishRow(survivingScene, sharedAssetId)

		await sceneSettingsService.revokeScenePublication({
			sceneId: revokedScene,
			userId: ownerId
		})

		expect(deleteAssetsSpy).not.toHaveBeenCalled()

		const survivors = await db
			.select({ sceneId: schema.scenePublished.sceneId })
			.from(schema.scenePublished)
			.where(eq(schema.scenePublished.sceneId, survivingScene))
		expect(survivors).toHaveLength(1)
	})

	it('collects a revoked GLB nothing else points at', async () => {
		const assetId = await makeAsset('solo.glb')
		const sceneId = await makeScene('solo')
		await publishRow(sceneId, assetId)

		await sceneSettingsService.revokeScenePublication({
			sceneId,
			userId: ownerId
		})

		expect(deleteAssetsSpy).toHaveBeenCalledWith([assetId])
	})

})
