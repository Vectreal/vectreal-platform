/**
 * Asks a real Postgres whether the server can tell a published file from the
 * saved scene it no longer matches.
 *
 * A publish records what its GLB was made from on `scene_published`, and the
 * stats every publisher surface reads compare that with the saved scene. A
 * mocked repository would only agree with itself about which links count as
 * the model, so the saves and publishes here run for real.
 *
 * `deleteAssets` is spied rather than executed: the Storage round trip is not
 * what these tests observe.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Optimizations, SceneSettings } from '@vctrl/core'

vi.mock(
	'../../app/lib/domain/asset/asset-storage.server',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../app/lib/domain/asset/asset-storage.server')
			>()
		return { ...actual, deleteAssets: vi.fn() }
	}
)

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Service =
	typeof import('../../app/lib/domain/scene/server/scene-settings-service.server')
type Manifest =
	typeof import('../../app/lib/domain/scene/server/scene-manifest.server')

describe('whether the published file is current', () => {
	let schema: Schema
	let db: Db
	let sceneSettingsService: Service['sceneSettingsService']
	let buildSceneManifest: Manifest['buildSceneManifest']
	let balancedPreset: Optimizations

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
			fileSize: 1024,
			ownerId
		})
		return assetId
	}

	const save = (
		sceneId: string,
		sceneAssetIds: string[],
		settings: Partial<SceneSettings> = {},
		optimizationSettings: Optimizations = balancedPreset
	) =>
		sceneSettingsService.saveSceneSettingsFromAssetIds({
			sceneId,
			projectId,
			userId: ownerId,
			meta: { name: 'Chair', description: '', thumbnailUrl: '' },
			settings: settings as SceneSettings,
			sceneAssetIds,
			optimizationSettings
		})

	const publish = async (sceneId: string) =>
		sceneSettingsService.publishSceneFromAssetId({
			sceneId,
			projectId,
			userId: ownerId,
			publishedAssetId: await makeAsset('published.glb')
		})

	const isCurrent = async (sceneId: string) =>
		(await sceneSettingsService.getSceneStats(sceneId))?.publishedIsCurrent

	/** A saved, published scene whose model is a document and a texture. */
	const publishedScene = async () => {
		const sceneId = randomUUID()
		const model = [
			await makeAsset('scene.gltf'),
			await makeAsset('textures/diffuse.png')
		]
		await save(sceneId, model)
		await publish(sceneId)
		return { sceneId, model }
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ sceneSettingsService } =
			await import('../../app/lib/domain/scene/server/scene-settings-service.server'))
		;({ buildSceneManifest } =
			await import('../../app/lib/domain/scene/server/scene-manifest.server'))
		;({ balancedPreset } = await import('../../app/constants/optimizations'))

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

	it('is current right after a publish', async () => {
		const { sceneId } = await publishedScene()

		expect(await isCurrent(sceneId)).toBe(true)
	})

	// The case this exists for: a save after a publish, without republishing.
	it('is not once a save replaces part of the model, and a reload reads the same', async () => {
		const { sceneId, model } = await publishedScene()

		await save(sceneId, [model[0], await makeAsset('textures/diffuse.png')])

		expect(await isCurrent(sceneId)).toBe(false)
		const manifest = await buildSceneManifest(sceneId, (id) => `/assets/${id}`)
		expect(manifest.stats?.publishedIsCurrent).toBe(false)
	})

	it('is current again once the scene is republished', async () => {
		const { sceneId, model } = await publishedScene()
		await save(sceneId, [model[0], await makeAsset('textures/diffuse.png')])

		await publish(sceneId)

		expect(await isCurrent(sceneId)).toBe(true)
	})

	// Draco is applied at publish, so switching it leaves the document, and
	// with it every asset and setting, exactly as saved.
	it('is not once Draco alone is switched off', async () => {
		const { sceneId, model } = await publishedScene()

		await save(
			sceneId,
			model,
			{},
			{
				...balancedPreset,
				draco: { ...balancedPreset.draco, enabled: false }
			}
		)

		expect(await isCurrent(sceneId)).toBe(false)
	})

	it('stays current through a save of exactly what was published', async () => {
		const { sceneId, model } = await publishedScene()

		await save(sceneId, model)

		expect(await isCurrent(sceneId)).toBe(true)
	})

	it('is not once the GPU texture switch changes', async () => {
		const { sceneId, model } = await publishedScene()

		await save(sceneId, model, {
			presentation: { compressTexturesForGpu: false }
		})

		expect(await isCurrent(sceneId)).toBe(false)
	})

	// Embeds read settings live, so a saved setting is already published.
	it('stays current through a settings save, a new thumbnail and a new bake', async () => {
		const { sceneId, model } = await publishedScene()

		await save(
			sceneId,
			[
				...model,
				await makeAsset(SCENE_THUMBNAIL_FILENAME),
				await makeAsset(PERSISTED_BAKE_FILENAME)
			],
			{ presentation: { showInfoPopover: true } }
		)

		expect(await isCurrent(sceneId)).toBe(true)
	})

	it('cannot say for a scene that is not published', async () => {
		const { sceneId } = await publishedScene()
		await sceneSettingsService.revokeScenePublication({
			sceneId,
			userId: ownerId
		})

		expect(await isCurrent(sceneId)).toBeNull()
	})

	it('cannot say for a publish made before it was recorded', async () => {
		const { sceneId } = await publishedScene()
		await db
			.update(schema.scenePublished)
			.set({ sourceFingerprint: null })
			.where(eq(schema.scenePublished.sceneId, sceneId))

		expect(await isCurrent(sceneId)).toBeNull()
	})
})
