/**
 * Round-trips a scene's kept original through a real Postgres.
 *
 * The original is linked to the scene like every other asset, so what keeps it
 * out of the model on screen is the role on its `scene_assets` row and the one
 * read that honors it. A mock would only agree with itself about that, and a
 * leak here downloads the whole original into every publisher load.
 *
 * `deleteAssets` is spied rather than executed: what matters is which ids the
 * save decides to collect, not the Storage round trip.
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

import type { SceneSettings } from '@vctrl/core'

const deleteAssetsSpy = vi.fn()

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
type Manifest =
	typeof import('../../app/lib/domain/scene/server/scene-manifest.server')

describe('a scene that keeps its original', () => {
	let schema: Schema
	let db: Db
	let sceneSettingsService: Service['sceneSettingsService']
	let buildSceneManifest: Manifest['buildSceneManifest']
	let loadHeaviestScenes: typeof import('../../app/lib/domain/billing/billing-dashboard-loader.server').loadHeaviestScenes

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	const makeAsset = async (name: string, mimeType: string, fileSize = 1024) => {
		const assetId = randomUUID()
		await db.insert(schema.assets).values({
			id: assetId,
			folderId: assetFolderId,
			name,
			type: 'model',
			filePath: `smoke/${assetId}/${name}`,
			fileSize,
			mimeType,
			ownerId
		})
		return assetId
	}

	const save = (
		sceneId: string,
		sceneAssetIds: string[],
		sourceAssetId?: string
	) =>
		sceneSettingsService.saveSceneSettingsFromAssetIds({
			sceneId,
			projectId,
			userId: ownerId,
			meta: { name: 'Chair', description: '', thumbnailUrl: '' },
			settings: {} as SceneSettings,
			sceneAssetIds,
			sourceAssetId
		})

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ sceneSettingsService } =
			await import('../../app/lib/domain/scene/server/scene-settings-service.server'))
		;({ buildSceneManifest } =
			await import('../../app/lib/domain/scene/server/scene-manifest.server'))
		;({ loadHeaviestScenes } =
			await import('../../app/lib/domain/billing/billing-dashboard-loader.server'))

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

	it('reads the original back apart from the model', async () => {
		const sceneId = randomUUID()
		const documentId = await makeAsset('scene.gltf', 'model/gltf+json')
		const bufferId = await makeAsset('scene.bin', 'application/octet-stream')
		const sourceId = await makeAsset('source.glb', 'model/gltf-binary')

		await save(sceneId, [documentId, bufferId], sourceId)

		const manifest = await buildSceneManifest(
			sceneId,
			(assetId) => `/assets/${assetId}`
		)
		expect(Object.keys(manifest.assetRefs ?? {})).toEqual([bufferId])
		expect(manifest.assets?.map((asset) => asset.id).sort()).toEqual(
			[documentId, bufferId].sort()
		)
		expect(manifest.source).toMatchObject({
			assetId: sourceId,
			url: `/assets/${sourceId}`,
			mimeType: 'model/gltf-binary'
		})
	})

	it('weighs the scene by what it loads, not by its original', async () => {
		const sceneId = randomUUID()
		const bufferId = await makeAsset(
			'scene.bin',
			'application/octet-stream',
			2048
		)
		const sourceId = await makeAsset('source.glb', 'model/gltf-binary', 9000)

		await save(sceneId, [bufferId], sourceId)
		// A link written without a role is part of the model, as every reader
		// takes it.
		const unlabeledId = await makeAsset('texture.png', 'image/png', 512)
		const [settingsRow] = await db
			.select({ id: schema.sceneSettings.id })
			.from(schema.sceneSettings)
			.where(eq(schema.sceneSettings.sceneId, sceneId))
		await db.insert(schema.sceneAssets).values({
			sceneSettingsId: settingsRow.id,
			assetId: unlabeledId
		})

		const heaviest = await loadHeaviestScenes(organizationId, 50)
		expect(heaviest.find((scene) => scene.id === sceneId)).toMatchObject({
			storageBytes: 2560,
			assetCount: 2
		})
	})

	it('keeps an unchanged original without a write', async () => {
		const sceneId = randomUUID()
		const bufferId = await makeAsset('scene.bin', 'application/octet-stream')
		const sourceId = await makeAsset('source.glb', 'model/gltf-binary')

		await save(sceneId, [bufferId], sourceId)
		const again = await save(sceneId, [bufferId], sourceId)

		expect(again).toMatchObject({ unchanged: true })
		expect(deleteAssetsSpy).not.toHaveBeenCalled()
	})

	it('relinks an asset whose role changed, though the ids did not', async () => {
		const sceneId = randomUUID()
		const bufferId = await makeAsset('scene.bin', 'application/octet-stream')
		const otherId = await makeAsset('other.bin', 'application/octet-stream')

		await save(sceneId, [bufferId], otherId)
		const again = await save(sceneId, [bufferId, otherId])

		expect(again).not.toMatchObject({ unchanged: true })
		const manifest = await buildSceneManifest(
			sceneId,
			(assetId) => `/assets/${assetId}`
		)
		expect(manifest.source).toBeNull()
		expect(Object.keys(manifest.assetRefs ?? {}).sort()).toEqual(
			[bufferId, otherId].sort()
		)
	})

	it('lets go of the original when a save leaves it out', async () => {
		const sceneId = randomUUID()
		const bufferId = await makeAsset('scene.bin', 'application/octet-stream')
		const sourceId = await makeAsset('source.glb', 'model/gltf-binary')

		await save(sceneId, [bufferId], sourceId)
		await save(sceneId, [bufferId])

		const manifest = await buildSceneManifest(
			sceneId,
			(assetId) => `/assets/${assetId}`
		)
		expect(manifest.source).toBeNull()
		expect(deleteAssetsSpy).toHaveBeenCalledWith([sourceId])
	})
})
