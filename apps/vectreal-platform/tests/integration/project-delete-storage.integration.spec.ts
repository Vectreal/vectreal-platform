/**
 * Asks a real Postgres whether a project delete can still name its storage
 * objects.
 *
 * The whole defect is a race with the FK cascade, and the cascade is the part a
 * mock cannot reproduce: `projects -> folders -> assets` is cascading the whole
 * way down, so the rows carrying `file_path` disappear inside the same
 * statement that removes the project. Read them a moment too late and the
 * objects are unnameable forever. The second test pins that premise directly,
 * so the first one cannot quietly stop meaning anything.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const deleteStorageObjectsSpy = vi.fn()

vi.mock(
	'../../app/lib/domain/asset/asset-storage.server',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../app/lib/domain/asset/asset-storage.server')
			>()
		return { ...actual, deleteStorageObjects: deleteStorageObjectsSpy }
	}
)

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Repo =
	typeof import('../../app/lib/domain/project/project-repository.server')

describe('project delete storage cleanup', () => {
	let schema: Schema
	let db: Db
	let deleteProject: Repo['deleteProject']

	const ownerId = randomUUID()
	const organizationId = randomUUID()

	const seedProject = async () => {
		const projectId = randomUUID()
		const folderId = randomUUID()
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Doomed project',
			slug: `doomed-${projectId}`
		})
		await db
			.insert(schema.folders)
			.values({ id: folderId, projectId, name: 'Scene Assets' })

		const paths: string[] = []
		for (const name of ['scene.gltf', 'buffer.bin']) {
			const assetId = randomUUID()
			const filePath = `scenes/${randomUUID()}/assets/${assetId}/${name}`
			await db.insert(schema.assets).values({
				id: assetId,
				folderId,
				name,
				type: 'model',
				filePath,
				ownerId
			})
			paths.push(filePath)
		}

		return { projectId, folderId, paths }
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ deleteProject } =
			await import('../../app/lib/domain/project/project-repository.server'))

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
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('hands storage every path the project owned', async () => {
		const { projectId, paths } = await seedProject()
		deleteStorageObjectsSpy.mockClear()

		await deleteProject(projectId, ownerId)

		expect(deleteStorageObjectsSpy).toHaveBeenCalledTimes(1)
		expect([...deleteStorageObjectsSpy.mock.calls[0][0]].sort()).toEqual(
			[...paths].sort()
		)
	})

	it('cascades the asset rows away, so the paths are unreadable afterwards', async () => {
		const { projectId, folderId } = await seedProject()

		const before = await db
			.select({ id: schema.assets.id })
			.from(schema.assets)
			.where(eq(schema.assets.folderId, folderId))
		expect(before).toHaveLength(2)

		await deleteProject(projectId, ownerId)

		const after = await db
			.select({ id: schema.assets.id })
			.from(schema.assets)
			.where(eq(schema.assets.folderId, folderId))
		expect(after).toEqual([])
	})
})
