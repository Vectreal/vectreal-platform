/**
 * Asks a real Postgres which hash a scene reports for a name two rows hold.
 *
 * `getExistingAssetHashes` keys by `asset.name`, and a name is not unique: when
 * garbage collection fails after a save - it is post-commit and swallows its own
 * errors - the superseded row stays linked beside its replacement. The loop that
 * builds the record then overwrites, so the surviving hash is whichever row came
 * last out of an unordered query. That decides reuse, so one save reuses the
 * asset and the next re-uploads it with nothing having changed.
 *
 * Unordered is not random, which is why this needs a database rather than a
 * mock: the planner is free to change its mind with the row count, and a mock
 * returns whatever it was handed. The assertion is that the answer is the same
 * every time and is the newer row.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Service =
	(typeof import('../../app/lib/domain/scene/server/scene-settings-service.server'))['sceneSettingsService']

describe('getExistingAssetHashes with two rows under one name', () => {
	let schema: Schema
	let db: Db
	let service: Service

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()
	const sceneId = randomUUID()
	const settingsId = randomUUID()

	const supersededId = randomUUID()
	const currentId = randomUUID()
	const fileName = 'body/diffuse.png'

	const addAsset = async (id: string, contentHash: string, createdAt: Date) => {
		await db.insert(schema.assets).values({
			id,
			folderId: assetFolderId,
			ownerId,
			name: fileName,
			filePath: `scenes/${sceneId}/assets/${id}/diffuse.png`,
			fileSize: 3,
			type: 'texture',
			mimeType: 'image/png',
			metadata: { contentHash },
			createdAt
		})
		await db
			.insert(schema.sceneAssets)
			.values({ sceneSettingsId: settingsId, assetId: id })
	}

	beforeAll(async () => {
		process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
		process.env.SUPABASE_SECRET_KEY ??= 'integration-test-key'

		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()

		/*
		  The singleton, because the class is not exported: it builds its own client
		  from `getDbClient()`, which is the same connection this fixture writes
		  through.
		*/
		;({ sceneSettingsService: service } =
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
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'Smoke scene' })
		await db
			.insert(schema.sceneSettings)
			.values({ id: settingsId, sceneId, createdBy: ownerId })

		/*
		  Inserted newest first, so insertion order disagrees with age. A read that
		  happens to come back in physical order would otherwise answer correctly by
		  accident and the test would pass without the ordering it exists to pin.
		*/
		await addAsset(currentId, 'hash-current', new Date('2026-02-01T00:00:00Z'))
		await addAsset(
			supersededId,
			'hash-superseded',
			new Date('2026-01-01T00:00:00Z')
		)
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('answers with the newer row, and answers the same way every time', async () => {
		const answers = []
		for (let attempt = 0; attempt < 5; attempt += 1) {
			answers.push(await service.getExistingAssetHashes(sceneId))
		}

		for (const answer of answers) {
			expect(answer[fileName]).toEqual({
				assetId: currentId,
				contentHash: 'hash-current'
			})
		}
	})
})
