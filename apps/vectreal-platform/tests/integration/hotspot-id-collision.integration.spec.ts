/**
 * A marker id another scene already has is refused before the save writes
 * anything.
 *
 * The agent settings route answers a refusal inside its transaction and then
 * commits it, so a refusal thrown after the first write would keep a half
 * save: the new camera stored, markers deleted, while the agent is told
 * nothing changed. Driven as that route drives the service.
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

import type { HotspotDefinition, SceneSettings } from '@vctrl/core'

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({ remove: async () => ({ data: null, error: null }) })
		}
	})
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Service =
	typeof import('../../app/lib/domain/scene/server/scene-settings-service.server')

describe('a marker id another scene has', () => {
	let schema: Schema
	let db: Db
	let service: Service['sceneSettingsService']
	let SceneSaveRefusedError: Service['SceneSaveRefusedError']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()
	const modelAssetId = randomUUID()
	const owningSceneId = randomUUID()
	const savingSceneId = randomUUID()
	const takenId = randomUUID()
	const keptId = randomUUID()

	const marker = (id: string, name: string): HotspotDefinition => ({
		id,
		name,
		worldPosition: [1, 2, 3],
		visible: true,
		internalOnly: false,
		stylePreset: 'dot'
	})
	const camera = (cameraId: string): SceneSettings['camera'] => ({
		cameras: [{ cameraId, name: cameraId, kind: 'scene' }]
	})

	const saveWithin = (sceneId: string, settings: SceneSettings) =>
		db.transaction(async (tx) => {
			try {
				await service.saveSceneSettingsWithin(tx, {
					sceneId,
					projectId,
					userId: ownerId,
					meta: { name: '', description: '', thumbnailUrl: '' },
					settings,
					sceneAssetIds: [modelAssetId]
				})
				return 'saved'
			} catch (error) {
				// The agent route answers this with a 400 and commits.
				if (error instanceof SceneSaveRefusedError) return error.message
				throw error
			}
		})

	const stored = (sceneId: string) =>
		db.transaction((tx) => service.readSceneSettingsWithin(tx, sceneId))

	beforeAll(async () => {
		process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
		process.env.SUPABASE_SECRET_KEY ??= 'integration-test-key'

		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ sceneSettingsService: service, SceneSaveRefusedError } =
			await import('../../app/lib/domain/scene/server/scene-settings-service.server'))

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@smoke.test`,
			name: 'Owner'
		})
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `smoke-${organizationId}`, ownerId })
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Smoke project',
			slug: `smoke-${projectId}`
		})
		await db
			.insert(schema.folders)
			.values({ id: assetFolderId, projectId, name: 'Scene Assets' })
		await db.insert(schema.assets).values({
			id: modelAssetId,
			folderId: assetFolderId,
			name: 'chair.glb',
			type: 'model',
			filePath: `smoke/${modelAssetId}/chair.glb`,
			fileSize: 1024,
			mimeType: 'model/gltf-binary',
			ownerId
		})
		await db.insert(schema.scenes).values([
			{ id: owningSceneId, projectId, folderId: null, name: 'Owner' },
			{ id: savingSceneId, projectId, folderId: null, name: 'Saver' }
		])

		expect(
			await saveWithin(owningSceneId, {
				camera: camera('owner'),
				hotspots: [marker(takenId, 'Taken')]
			})
		).toBe('saved')
		expect(
			await saveWithin(savingSceneId, {
				camera: camera('before'),
				hotspots: [marker(keptId, 'Kept')]
			})
		).toBe('saved')
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('is refused, and the saving scene keeps everything it had', async () => {
		const outcome = await saveWithin(savingSceneId, {
			camera: camera('after'),
			hotspots: [marker(takenId, 'Copied')]
		})

		expect(outcome).toBe(
			`Another scene's marker already has the id ${takenId}. Give each new marker a new id`
		)
		const saving = await stored(savingSceneId)
		expect(saving?.settings.camera?.cameras?.[0]?.cameraId).toBe('before')
		expect(saving?.settings.hotspots?.map((h) => h.id)).toEqual([keptId])
		const owning = await stored(owningSceneId)
		expect(owning?.settings.hotspots?.map((h) => h.name)).toEqual(['Taken'])
	})
})
