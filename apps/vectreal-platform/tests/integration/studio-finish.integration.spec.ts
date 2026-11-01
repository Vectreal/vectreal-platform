/**
 * Asks a real Postgres what a draft does with the studio finish saved with
 * it: kept apart from the model, shown only while it still matches what the
 * scene would publish, kept by a save that leaves it out, and never offered
 * to an embed.
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

describe('the studio finish a draft keeps', () => {
	let schema: Schema
	let db: Db
	let sceneSettingsService: Service['sceneSettingsService']
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
		studioFinish?: { assetId: string; reports: typeof reports } | null
	) =>
		sceneSettingsService.saveSceneSettingsFromAssetIds({
			sceneId,
			projectId,
			userId: ownerId,
			meta: { name: 'Chair', description: '', thumbnailUrl: '' },
			settings: settings as SceneSettings,
			sceneAssetIds,
			optimizationSettings: balancedPreset,
			studioFinish
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

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ sceneSettingsService } =
			await import('../../app/lib/domain/scene/server/scene-settings-service.server'))
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

	const reports = { occlusion: { baked: ['body'], skipped: [] } }
	const baked = {
		lights: [{ role: 'key' as const, azimuth: 30 }],
		bake: { lights: true }
	}

	/** A saved draft with a finish made for its baked lighting. */
	const draftWithFinish = async () => {
		const sceneId = randomUUID()
		const model = [
			await makeAsset('scene.gltf'),
			await makeAsset('textures/diffuse.png')
		]
		const finishId = await makeAsset('studio-finish.glb')
		await save(
			sceneId,
			model,
			{ lighting: baked },
			{ assetId: finishId, reports }
		)
		return { sceneId, model, finishId }
	}

	it('resolves while the scene is as it was saved, apart from the model', async () => {
		const { sceneId, finishId } = await draftWithFinish()

		const finish = await sceneSettingsService.resolveSceneFinish(sceneId)
		expect(finish).toMatchObject({ asset: { id: finishId }, reports })
		const modelAssets = await sceneSettingsService.getSceneAssetRecords(sceneId)
		expect(modelAssets.map(({ id }) => id)).not.toContain(finishId)
	})

	it('retires once a baked light moves', async () => {
		const { sceneId, model } = await draftWithFinish()

		await save(sceneId, model, {
			lighting: { ...baked, lights: [{ role: 'key', azimuth: 31 }] }
		})

		expect(await sceneSettingsService.resolveSceneFinish(sceneId)).toBeNull()
	})

	it('stays through a save that leaves it out, and goes with one that drops it', async () => {
		const { sceneId, model, finishId } = await draftWithFinish()

		await save(sceneId, model, {
			lighting: baked,
			presentation: { showInfoPopover: true }
		})
		expect(
			await sceneSettingsService.resolveSceneFinish(sceneId)
		).toMatchObject({
			asset: { id: finishId }
		})

		await save(sceneId, model, { lighting: baked }, null)
		expect(await sceneSettingsService.resolveSceneFinish(sceneId)).toBeNull()
	})

	it('is kept out of what a settings-only save relinks as the model', async () => {
		const { sceneId, finishId } = await draftWithFinish()

		const stored = await db.transaction((tx) =>
			sceneSettingsService.readSceneSettingsWithin(tx, sceneId)
		)

		expect(stored?.sceneAssetIds).not.toContain(finishId)
	})

	it('is the model of the draft manifest, at an address only a member can open', async () => {
		const { sceneId, finishId } = await draftWithFinish()
		const { buildDraftFinishManifest } =
			await import('../../app/lib/domain/embed/inline-embed-manifest.server')
		const { readEmbedSceneSettings } =
			await import('../../app/lib/domain/scene/server/scene-manifest.server')

		const manifest = await buildDraftFinishManifest(
			new Request('http://localhost/'),
			{
				projectId,
				sceneId,
				finish: (await sceneSettingsService.resolveSceneFinish(sceneId))!.asset,
				settingsData: await readEmbedSceneSettings(sceneId)
			}
		)

		expect(manifest?.publishedModel?.url).toBe(
			`/api/scenes/${sceneId}/assets/${finishId}`
		)
		expect(JSON.stringify(manifest)).not.toMatch(/token=|sig=|signature/)
	})

	it('is never an asset an embed may fetch', async () => {
		const { sceneId, finishId } = await draftWithFinish()
		const { isEmbedServableAssetId, selectEmbedServableAssets } =
			await import('../../app/lib/domain/scene/embed-asset-policy')
		const settingsData =
			await sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId, {
				includeGltfJson: false
			})

		const servable = selectEmbedServableAssets({
			sceneId,
			publishedAssetId: randomUUID(),
			sceneAssets: settingsData?.assets ?? [],
			bakedShadowAssetId: settingsData?.settings?.shadows?.baked?.assetId,
			hotspots: settingsData?.settings?.hotspots
		})

		expect(isEmbedServableAssetId(finishId, servable)).toBe(false)
	})

	it('leaves a published scene current, since the published file is not it', async () => {
		const { sceneId } = await draftWithFinish()
		await publish(sceneId)

		expect(await isCurrent(sceneId)).toBe(true)
	})
})
