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
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
	isEmbedServableAssetId,
	selectEmbedServableAssets
} from '../../app/lib/domain/scene/embed-asset-policy'

/*
  Storage and the session are faked at their boundaries: the session asset
  route's authorization is the subject, and it reads only Postgres. Every
  download answers with the object path, so a test can tell which row served.
*/
vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				download: async (path: string) => ({
					data: new Blob([path]),
					error: null
				})
			})
		}
	})
}))

const sessionUser = vi.hoisted(() => ({ id: '' }))

vi.mock('../../app/lib/http/auth.server', () => ({
	getAuthUser: async () => ({
		user: { id: sessionUser.id },
		headers: new Headers()
	})
}))

type Schema = typeof import('../../app/db/schema')
type AssetRoute =
	typeof import('../../app/routes/api/scenes.$sceneId.assets.$assetId')
type ThumbnailRoute =
	typeof import('../../app/routes/api/scenes.$sceneId.thumbnail.$assetId')
type SettingsRepository =
	typeof import('../../app/lib/domain/scene/server/scene-settings-repository.server')
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
	let assetLoader: AssetRoute['loader']
	let updateScenePresentation: SettingsRepository['updateScenePresentation']
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
		;({ loader: assetLoader } =
			await import('../../app/routes/api/scenes.$sceneId.assets.$assetId'))
		;({ updateScenePresentation } =
			await import('../../app/lib/domain/scene/server/scene-settings-repository.server'))
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

	describe('a signed-in session', () => {
		const outsiderId = randomUUID()

		beforeAll(() => {
			vi.stubEnv('SUPABASE_URL', process.env.SUPABASE_URL || 'http://127.0.0.1')
			vi.stubEnv(
				'SUPABASE_SECRET_KEY',
				process.env.SUPABASE_SECRET_KEY || 'integration-secret'
			)
		})

		afterAll(() => {
			vi.unstubAllEnvs()
		})

		const fetchAsset = async (userId: string, assetId: string) => {
			sessionUser.id = userId
			const response = await assetLoader({
				request: new Request(
					`https://vectreal.test/api/scenes/${sceneId}/assets/${assetId}?preview=1&projectId=${projectId}`
				),
				params: { sceneId, assetId }
			} as never)
			return response as Response
		}

		it('serves a member the published GLB, which no scene_assets row names', async () => {
			const response = await fetchAsset(ownerId, publishedAssetId)

			expect(response.status).toBe(200)
			expect(await response.text()).toBe(`smoke/${publishedAssetId}.glb`)
		})

		it("still serves a member the draft's linked buffer", async () => {
			const response = await fetchAsset(ownerId, bufferAssetId)

			expect(response.status).toBe(200)
			expect(await response.text()).toBe(`smoke/${bufferAssetId}.bin`)
		})

		it('answers a non-member 404 for the published GLB', async () => {
			const response = await fetchAsset(outsiderId, publishedAssetId)

			expect(response.status).toBe(404)
		})

		it('answers a non-member 404 for a linked asset too', async () => {
			const response = await fetchAsset(outsiderId, bufferAssetId)

			expect(response.status).toBe(404)
		})

		/*
		  A member of the project is still refused an asset that this scene does
		  not link: membership opens the scene, and only `scene_assets` says which
		  rows belong to it. The asset sits in the same project and folder, so
		  nothing but the link tells the two apart.
		*/
		it('answers a member 404 for an asset the scene does not link', async () => {
			const unlinkedAssetId = randomUUID()
			await db.insert(schema.assets).values({
				id: unlinkedAssetId,
				folderId: assetFolderId,
				name: 'other-scene.bin',
				type: 'model',
				filePath: `smoke/${unlinkedAssetId}.bin`,
				mimeType: 'application/octet-stream',
				fileSize: 1024,
				ownerId
			})

			const response = await fetchAsset(ownerId, unlinkedAssetId)

			expect(response.status).toBe(404)
		})
	})

	describe('the thumbnail route', () => {
		const outsiderId = randomUUID()
		const otherSceneId = randomUUID()
		const foreignOrganizationId = randomUUID()
		const foreignProjectId = randomUUID()
		const foreignFolderId = randomUUID()
		const foreignAssetId = randomUUID()
		let thumbnailLoader: ThumbnailRoute['loader']

		beforeAll(async () => {
			vi.stubEnv('SUPABASE_URL', process.env.SUPABASE_URL || 'http://127.0.0.1')
			vi.stubEnv(
				'SUPABASE_SECRET_KEY',
				process.env.SUPABASE_SECRET_KEY || 'integration-secret'
			)
			;({ loader: thumbnailLoader } =
				await import('../../app/routes/api/scenes.$sceneId.thumbnail.$assetId'))

			// A second scene in the same project, which a member can open but
			// whose thumbnail is not this asset.
			await db.insert(schema.scenes).values({
				id: otherSceneId,
				projectId,
				folderId: null,
				name: 'Other scene'
			})
			await db
				.update(schema.scenes)
				.set({
					thumbnailUrl: `/api/scenes/${sceneId}/thumbnail/${thumbnailAssetId}`
				})
				.where(eq(schema.scenes.id, sceneId))
			// The de-duplicated shape: the row was created by another scene, so
			// its metadata names that one. The old rule refused this thumbnail.
			await db
				.update(schema.assets)
				.set({ metadata: { sceneId: otherSceneId } })
				.where(eq(schema.assets.id, thumbnailAssetId))

			// An asset in another organization's project, which this scene's
			// members have no claim on.
			await db.insert(schema.organizations).values({
				id: foreignOrganizationId,
				name: `smoke-${foreignOrganizationId}`,
				ownerId
			})
			await db.insert(schema.projects).values({
				id: foreignProjectId,
				organizationId: foreignOrganizationId,
				name: 'Foreign project',
				slug: `smoke-${foreignProjectId}`
			})
			await db.insert(schema.folders).values({
				id: foreignFolderId,
				projectId: foreignProjectId,
				name: 'Scene Assets'
			})
			await db.insert(schema.assets).values({
				id: foreignAssetId,
				folderId: foreignFolderId,
				name: 'secret.glb',
				type: 'model',
				filePath: `smoke/${foreignAssetId}.glb`,
				mimeType: 'model/gltf-binary',
				ownerId
			})
		})

		afterAll(async () => {
			vi.unstubAllEnvs()
			await db
				.delete(schema.organizations)
				.where(eq(schema.organizations.id, foreignOrganizationId))
			await db
				.update(schema.scenes)
				.set({ thumbnailUrl: null })
				.where(eq(schema.scenes.id, sceneId))
			await db.delete(schema.scenes).where(eq(schema.scenes.id, otherSceneId))
		})

		const fetchThumbnail = async (
			userId: string,
			assetId: string,
			forSceneId = sceneId
		) => {
			sessionUser.id = userId
			const response = await thumbnailLoader({
				request: new Request(
					`https://vectreal.test/api/scenes/${forSceneId}/thumbnail/${assetId}`
				),
				params: { sceneId: forSceneId, assetId }
			} as never)
			return response as Response
		}

		it("serves a member the scene's thumbnail whatever its metadata names", async () => {
			const response = await fetchThumbnail(ownerId, thumbnailAssetId)

			expect(response.status).toBe(200)
			expect(await response.text()).toBe(`smoke/${thumbnailAssetId}.webp`)
			expect(response.headers.get('Last-Modified')).toMatch(/GMT$/)
		})

		it('answers a member 404 for a linked asset that is not the thumbnail', async () => {
			const response = await fetchThumbnail(ownerId, bufferAssetId)

			expect(response.status).toBe(404)
		})

		it('answers a member 404 for a thumbnail under a scene that does not show it', async () => {
			const response = await fetchThumbnail(
				ownerId,
				thumbnailAssetId,
				otherSceneId
			)

			expect(response.status).toBe(404)
		})

		it('answers a member 404, not 500, for an asset id that is not a uuid', async () => {
			const response = await fetchThumbnail(ownerId, 'not-a-uuid')

			expect(response.status).toBe(404)
		})

		it("answers 404 when a member points thumbnail_url at another project's asset", async () => {
			const setThumbnail = (assetId: string) =>
				db
					.update(schema.scenes)
					.set({ thumbnailUrl: `/api/scenes/${sceneId}/thumbnail/${assetId}` })
					.where(eq(schema.scenes.id, sceneId))

			await setThumbnail(foreignAssetId)
			try {
				const response = await fetchThumbnail(ownerId, foreignAssetId)

				expect(response.status).toBe(404)
			} finally {
				await setThumbnail(thumbnailAssetId)
			}
		})

		it('answers a non-member 404 for the real thumbnail', async () => {
			const response = await fetchThumbnail(outsiderId, thumbnailAssetId)

			expect(response.status).toBe(404)
		})
	})

	describe('the presentation write', () => {
		afterAll(async () => {
			await db
				.update(schema.sceneSettings)
				.set({ presentation: null })
				.where(eq(schema.sceneSettings.id, settingsId))
		})

		it('merges one field and keeps the others', async () => {
			await db
				.update(schema.sceneSettings)
				.set({ presentation: { showInfoPopover: false } })
				.where(eq(schema.sceneSettings.id, settingsId))

			const updated = await updateScenePresentation(sceneId, {
				showLoadingThumbnail: true
			})

			expect(updated).toEqual({
				showInfoPopover: false,
				showLoadingThumbnail: true
			})
			const [row] = await db
				.select({ presentation: schema.sceneSettings.presentation })
				.from(schema.sceneSettings)
				.where(eq(schema.sceneSettings.id, settingsId))
			expect(row.presentation).toEqual(updated)
		})

		it('writes into a scene that stored no presentation at all', async () => {
			await db
				.update(schema.sceneSettings)
				.set({ presentation: null })
				.where(eq(schema.sceneSettings.id, settingsId))

			expect(
				await updateScenePresentation(sceneId, { showLoadingThumbnail: false })
			).toEqual({ showLoadingThumbnail: false })
		})

		it("moves the settings timestamp the manifest's ETag is keyed on", async () => {
			const stale = new Date('2026-01-01T00:00:00.000Z')
			await db
				.update(schema.sceneSettings)
				.set({ updatedAt: stale })
				.where(eq(schema.sceneSettings.id, settingsId))

			await updateScenePresentation(sceneId, { showLoadingThumbnail: true })

			const [row] = await db
				.select({ updatedAt: schema.sceneSettings.updatedAt })
				.from(schema.sceneSettings)
				.where(eq(schema.sceneSettings.id, settingsId))
			expect(row.updatedAt.getTime()).toBeGreaterThan(stale.getTime())
		})

		it('answers null for a scene with no settings row', async () => {
			expect(
				await updateScenePresentation(randomUUID(), {
					showLoadingThumbnail: true
				})
			).toBeNull()
		})
	})
})
