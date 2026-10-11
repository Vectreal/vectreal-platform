/**
 * `updateSceneMetadata` against real rows: what an omitted field does.
 *
 * The scene page's title editor posts only a name and a description, and the
 * writer used to fold the missing `thumbnailUrl` into null, so every rename
 * wiped the scene's thumbnail. The thumbnail route then 404'd and the GC read
 * the image as unreferenced. An omitted field has to leave the column alone;
 * only an explicit empty value clears it.
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type SceneRepo =
	typeof import('../../app/lib/domain/scene/server/scene-folder-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('updateSceneMetadata', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let updateSceneMetadata: SceneRepo['updateSceneMetadata']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const sceneId = randomUUID()

	const THUMBNAIL_URL = `/api/scenes/${sceneId}/thumbnail/${randomUUID()}`

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ updateSceneMetadata } =
			await import('../../app/lib/domain/scene/server/scene-folder-repository.server'))
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
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'Before'
		})
	})

	beforeEach(async () => {
		await db
			.update(schema.scenes)
			.set({
				name: 'Before',
				description: 'A description',
				thumbnailUrl: THUMBNAIL_URL
			})
			.where(eq(schema.scenes.id, sceneId))
	})

	afterAll(async () => {
		// Organizations cascade to projects and scenes.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it("keeps the thumbnail through a rename, the title editor's shape", async () => {
		const updated = await updateSceneMetadata(sceneId, ownerId, {
			name: 'After',
			description: 'A description'
		})

		expect(updated.name).toBe('After')
		expect(updated.thumbnailUrl).toBe(THUMBNAIL_URL)
	})

	it('keeps the description when it is omitted', async () => {
		const updated = await updateSceneMetadata(sceneId, ownerId, {
			name: 'After'
		})

		expect(updated.description).toBe('A description')
		expect(updated.thumbnailUrl).toBe(THUMBNAIL_URL)
	})

	it('clears the thumbnail when the caller sends it empty', async () => {
		const updated = await updateSceneMetadata(sceneId, ownerId, {
			name: 'After',
			description: 'A description',
			thumbnailUrl: ''
		})

		expect(updated.thumbnailUrl).toBeNull()
	})

	it('writes a new thumbnail when the caller sends one', async () => {
		const next = `/api/scenes/${sceneId}/thumbnail/${randomUUID()}`

		const updated = await updateSceneMetadata(sceneId, ownerId, {
			name: 'After',
			description: 'A description',
			thumbnailUrl: next
		})

		expect(updated.thumbnailUrl).toBe(next)
	})
})
