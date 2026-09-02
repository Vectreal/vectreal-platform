/**
 * Proves, against real rows, that the embed manifest and the embed asset gate
 * agree about which assets exist.
 *
 * They did not. `toAssetRefs` offered every `scene_assets` row while the asset
 * route served only `scene_published.asset_id` - an id `uploadPublishedGlb`
 * writes without ever calling `linkSceneAssets`, so it is never in
 * `scene_assets`. The two sets were disjoint and no embed could load a single
 * byte. A unit test can assert the policy is self-consistent; only a real
 * database can show that the rows publishing actually writes produce two sets
 * that match.
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
	isEmbedServableAssetId,
	selectEmbedServableAssets
} from '../../app/lib/domain/scene/embed-asset-policy'

type Schema = typeof import('../../app/db/schema')
type Manifest =
	typeof import('../../app/lib/domain/scene/server/scene-manifest.server')
type PreviewRepo =
	typeof import('../../app/lib/domain/scene/server/scene-preview-repository.server')
type SettingsService =
	typeof import('../../app/lib/domain/scene/server/scene-settings-service.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

const buildAssetUrl = (assetId: string) => `/api/assets/${assetId}`

describe('embed asset authorization', () => {
	// Loaded in `beforeAll` rather than at module scope: these modules call
	// `getDbClient()` on import, which throws without a `DATABASE_URL`.
	let schema: Schema
	let buildEmbedSceneManifest: Manifest['buildEmbedSceneManifest']
	let getPublishedScenePreview: PreviewRepo['getPublishedScenePreview']
	let toPublishedModelRow: PreviewRepo['toPublishedModelRow']
	let sceneSettingsService: SettingsService['sceneSettingsService']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	const sceneId = randomUUID()
	const settingsId = randomUUID()
	const publishedAssetId = randomUUID()
	const bufferAssetId = randomUUID()
	const textureAssetId = randomUUID()
	const bakeAssetId = randomUUID()
	const thumbnailAssetId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ buildEmbedSceneManifest } =
			await import('../../app/lib/domain/scene/server/scene-manifest.server'))
		;({ getPublishedScenePreview, toPublishedModelRow } =
			await import('../../app/lib/domain/scene/server/scene-preview-repository.server'))
		;({ sceneSettingsService } =
			await import('../../app/lib/domain/scene/server/scene-settings-service.server'))
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

		// The editor assets a save writes, all linked through `scene_assets`.
		await db.insert(schema.assets).values([
			{
				id: bufferAssetId,
				folderId: assetFolderId,
				name: 'buffer.bin',
				type: 'model',
				filePath: `smoke/${bufferAssetId}.bin`,
				mimeType: 'application/octet-stream',
				fileSize: 2902308,
				ownerId
			},
			{
				id: textureAssetId,
				folderId: assetFolderId,
				name: 'Shoe_baseColor.webp',
				type: 'texture',
				filePath: `smoke/${textureAssetId}.webp`,
				mimeType: 'image/webp',
				fileSize: 84996,
				ownerId
			},
			{
				id: bakeAssetId,
				folderId: assetFolderId,
				name: PERSISTED_BAKE_FILENAME,
				type: 'texture',
				filePath: `smoke/${bakeAssetId}.png`,
				mimeType: 'image/png',
				fileSize: 27530,
				ownerId
			},
			{
				id: thumbnailAssetId,
				folderId: assetFolderId,
				name: SCENE_THUMBNAIL_FILENAME,
				type: 'texture',
				filePath: `smoke/${thumbnailAssetId}.webp`,
				mimeType: 'image/webp',
				fileSize: 4096,
				ownerId
			},
			// The published GLB. Deliberately NOT linked into `scene_assets`,
			// because `uploadPublishedGlb` never links it. This is the exact
			// production shape that made the two sets disjoint.
			{
				id: publishedAssetId,
				folderId: assetFolderId,
				name: 'blue-vans-shoe.glb',
				type: 'model',
				filePath: `smoke/${publishedAssetId}.glb`,
				mimeType: 'model/gltf-binary',
				fileSize: 812345,
				ownerId
			}
		])

		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'Blue Vans Shoe',
			status: 'published'
		})
		await db.insert(schema.sceneSettings).values({
			id: settingsId,
			sceneId,
			createdBy: ownerId,
			shadows: { baked: { assetId: bakeAssetId, signature: 'sig-1' } }
		})
		await db.insert(schema.sceneAssets).values([
			{ sceneSettingsId: settingsId, assetId: bufferAssetId },
			{ sceneSettingsId: settingsId, assetId: textureAssetId },
			{ sceneSettingsId: settingsId, assetId: bakeAssetId },
			{ sceneSettingsId: settingsId, assetId: thumbnailAssetId }
		])
		await db.insert(schema.scenePublished).values({
			sceneId,
			assetId: publishedAssetId,
			publishedBy: ownerId
		})
	})

	afterAll(async () => {
		// Organizations cascade to projects, folders, scenes and assets.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	/** What the asset route computes, from the same rows the route reads. */
	async function routeServableSet() {
		const preview = await getPublishedScenePreview(projectId, sceneId)
		expect(preview).not.toBeNull()

		const settingsData =
			await sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId, {
				includeGltfJson: false
			})

		return selectEmbedServableAssets({
			publishedAssetId: preview!.publishedAssetId,
			sceneAssets: settingsData?.assets ?? [],
			bakedShadowAssetId: settingsData?.settings?.shadows?.baked?.assetId
		})
	}

	it('reproduces the production shape: the published GLB is not a scene asset', async () => {
		const settingsData =
			await sceneSettingsService.getSceneSettingsWithAssetRefs(sceneId, {
				includeGltfJson: false
			})

		expect(settingsData?.assets.map((asset) => asset.id)).not.toContain(
			publishedAssetId
		)
	})

	it('serves every asset the embed manifest references', async () => {
		const preview = await getPublishedScenePreview(projectId, sceneId)
		const manifest = await buildEmbedSceneManifest(
			sceneId,
			toPublishedModelRow(preview!),
			buildAssetUrl
		)
		const servable = await routeServableSet()

		const referenced = [
			...Object.keys(manifest.assetRefs),
			preview!.publishedAssetId
		]

		expect(referenced.length).toBeGreaterThan(0)
		for (const assetId of referenced) {
			expect(
				isEmbedServableAssetId(assetId, servable),
				`manifest references ${assetId} but the gate refuses it`
			).toBe(true)
		}
	})

	it('refuses every editor asset, which the manifest never references', async () => {
		const servable = await routeServableSet()

		for (const assetId of [bufferAssetId, textureAssetId, thumbnailAssetId]) {
			expect(isEmbedServableAssetId(assetId, servable)).toBe(false)
		}
	})

	it('references the published GLB and the bake, and no editor assets', async () => {
		const preview = await getPublishedScenePreview(projectId, sceneId)
		const manifest = await buildEmbedSceneManifest(
			sceneId,
			toPublishedModelRow(preview!),
			buildAssetUrl
		)

		expect(manifest.publishedModel).toEqual({
			url: buildAssetUrl(publishedAssetId),
			fileName: 'blue-vans-shoe.glb',
			mimeType: 'model/gltf-binary',
			byteSize: 812345
		})
		expect(Object.keys(manifest.assetRefs)).toEqual([bakeAssetId])
	})

	it('withholds the editor scene graph and asset rows from an embed', async () => {
		const preview = await getPublishedScenePreview(projectId, sceneId)
		const manifest = await buildEmbedSceneManifest(
			sceneId,
			toPublishedModelRow(preview!),
			buildAssetUrl
		)

		expect(manifest).not.toHaveProperty('gltfJson')
		expect(manifest).not.toHaveProperty('assets')
		expect(manifest).not.toHaveProperty('stats')
	})

	/**
	 * Filtering the hotspot array alone leaves the linked camera behind, and
	 * `@vctrl/embed` exposes `activateCamera(cameraId)` to the host page - so a
	 * third-party site could read the hidden viewpoint's pose out of the manifest
	 * and fly an anonymous visitor straight to it.
	 */
	it('drops internalOnly hotspots and the cameras that would resurrect them', async () => {
		const publicHotspotId = randomUUID()
		const internalHotspotId = randomUUID()
		const legacyInternalHotspotId = randomUUID()

		await db
			.update(schema.sceneSettings)
			.set({
				camera: {
					activeCameraId: 'cam-backstage',
					cameras: [
						{ cameraId: 'cam-scene', name: 'Default', kind: 'scene' },
						{
							cameraId: 'cam-sole',
							name: 'Sole detail',
							kind: 'hotspot',
							position: [1, 1, 1]
						},
						{
							cameraId: 'cam-backstage',
							name: 'Backstage rig',
							kind: 'hotspot',
							position: [9, 9, 9]
						},
						/*
						  Untagged, the shape the publisher produced before it started
						  tagging paired cameras. Every scene already in the database
						  has one of these, and `isSceneCamera` reads it as a scene
						  camera - so a `kind`-based filter would leak it.
						*/
						{
							cameraId: 'hotspot-camera-1755123456789-a1b2',
							name: 'Legacy backstage rig',
							position: [8, 8, 8]
						}
					]
				},
				interactions: [
					{
						id: 'i-internal',
						trigger: { source: 'viewer', type: 'viewer_ready' },
						actions: [{ type: 'activate_camera', cameraId: 'cam-backstage' }]
					}
				]
			})
			.where(eq(schema.sceneSettings.id, settingsId))

		await db.insert(schema.sceneHotspots).values([
			{
				id: publicHotspotId,
				sceneSettingsId: settingsId,
				name: 'Sole',
				linkedCameraId: 'cam-sole',
				visible: true,
				internalOnly: false
			},
			{
				id: internalHotspotId,
				sceneSettingsId: settingsId,
				name: 'Internal note',
				linkedCameraId: 'cam-backstage',
				visible: true,
				internalOnly: true
			},
			{
				id: legacyInternalHotspotId,
				sceneSettingsId: settingsId,
				name: 'Legacy internal note',
				linkedCameraId: 'hotspot-camera-1755123456789-a1b2',
				visible: true,
				internalOnly: true
			}
		])

		const preview = await getPublishedScenePreview(projectId, sceneId)
		const manifest = await buildEmbedSceneManifest(
			sceneId,
			toPublishedModelRow(preview!),
			buildAssetUrl
		)

		expect(manifest.settings?.hotspots?.map((hotspot) => hotspot.name)).toEqual(
			['Sole']
		)
		expect(
			manifest.settings?.camera?.cameras?.map((camera) => camera.cameraId)
		).toEqual(['cam-scene', 'cam-sole'])
		expect(manifest.settings?.camera?.activeCameraId).toBeUndefined()
		expect(manifest.settings?.interactions).toEqual([])
		// Nothing anywhere in the payload should name either hidden viewpoint.
		expect(JSON.stringify(manifest)).not.toContain('cam-backstage')
		expect(JSON.stringify(manifest)).not.toContain(
			'hotspot-camera-1755123456789-a1b2'
		)
		expect(JSON.stringify(manifest)).not.toContain('Legacy backstage rig')

		await db
			.delete(schema.sceneHotspots)
			.where(eq(schema.sceneHotspots.sceneSettingsId, settingsId))
	})
})
