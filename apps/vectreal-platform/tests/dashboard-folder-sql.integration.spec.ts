/**
 * Runs the folder SQL against a real Postgres.
 *
 * Everything here is net-new query work that nothing else exercises: a
 * recursive CTE, the first `parent_folder_id` UPDATE in the codebase, and a
 * folder delete that recurses. Unit tests cannot reach any of it - a typo in
 * the CTE would only show up as a 500 on the first click.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm supabase start
 *   DASHBOARD_DB_SMOKE=1 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     pnpm nx test vectreal-platform -- --run dashboard-folder-sql
 *
 * Every row it creates is namespaced by a run id and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const shouldRun = Boolean(process.env.DASHBOARD_DB_SMOKE)

type Schema = typeof import('../app/db/schema')
type Repository =
	typeof import('../app/lib/domain/scene/server/scene-folder-repository.server')
type EntityLoader =
	typeof import('../app/lib/domain/dashboard/dashboard-entity-loader.server')
type Db = ReturnType<typeof import('../app/db/client').getDbClient>

describe.skipIf(!shouldRun)('folder SQL against a real database', () => {
	// Loaded in `beforeAll` rather than at module scope: `skipIf` still evaluates
	// this callback to collect the (skipped) tests, and every one of these
	// modules calls `getDbClient()` on import, which throws without a
	// `DATABASE_URL`. That would fail the file on a normal `nx test` run.
	let schema: Schema
	let repository: Repository
	let loadDashboardEntityRefs: EntityLoader['loadDashboardEntityRefs']
	let db: Db

	const ownerId = randomUUID()
	const memberId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const otherProjectId = randomUUID()

	/*
	  root
	    branch
	      leaf
	  sibling
	*/
	const rootId = randomUUID()
	const branchId = randomUUID()
	const leafId = randomUUID()
	const siblingId = randomUUID()

	const leafSceneId = randomUUID()
	const rootSceneId = randomUUID()
	const publishedSceneId = randomUUID()

	const assetFolderId = randomUUID()
	const publishedAssetId = randomUUID()

	beforeAll(async () => {
		schema = await import('../app/db/schema')
		repository =
			await import('../app/lib/domain/scene/server/scene-folder-repository.server')
		;({ loadDashboardEntityRefs } =
			await import('../app/lib/domain/dashboard/dashboard-entity-loader.server'))
		db = (await import('../app/db/client')).getDbClient()

		await db.insert(schema.users).values([
			{ id: ownerId, email: `owner-${ownerId}@smoke.test`, name: 'Owner' },
			{ id: memberId, email: `member-${memberId}@smoke.test`, name: 'Member' }
		])
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `smoke-${organizationId}`, ownerId })
		await db.insert(schema.organizationMemberships).values([
			{ userId: ownerId, organizationId, role: 'owner' },
			{ userId: memberId, organizationId, role: 'member' }
		])
		await db.insert(schema.projects).values([
			{
				id: projectId,
				organizationId,
				name: 'Smoke project',
				slug: `smoke-${projectId}`
			},
			{
				id: otherProjectId,
				organizationId,
				name: 'Other project',
				slug: `other-${otherProjectId}`
			}
		])
		await db.insert(schema.sceneFolders).values([
			{ id: rootId, projectId, name: 'root', ownerId, parentFolderId: null },
			{
				id: branchId,
				projectId,
				name: 'branch',
				ownerId,
				parentFolderId: rootId
			},
			{
				id: leafId,
				projectId,
				name: 'leaf',
				ownerId,
				parentFolderId: branchId
			},
			{
				id: siblingId,
				projectId,
				name: 'sibling',
				ownerId,
				parentFolderId: null
			}
		])
		await db.insert(schema.scenes).values([
			{ id: leafSceneId, projectId, folderId: leafId, name: 'leaf scene' },
			{ id: rootSceneId, projectId, folderId: rootId, name: 'root scene' },
			{
				id: publishedSceneId,
				projectId,
				folderId: null,
				name: 'published scene',
				status: 'published'
			}
		])

		// A published GLB, so the delete path has an asset to hand back.
		await db
			.insert(schema.folders)
			.values({ id: assetFolderId, projectId, name: 'Scene Assets' })
		await db.insert(schema.assets).values({
			id: publishedAssetId,
			folderId: assetFolderId,
			name: 'published.glb',
			type: 'model',
			filePath: `smoke/${publishedAssetId}.glb`,
			ownerId
		})
		await db.insert(schema.scenePublished).values({
			sceneId: publishedSceneId,
			assetId: publishedAssetId,
			publishedBy: ownerId
		})
	})

	afterAll(async () => {
		// Organizations cascade to projects, folders and scenes.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [ownerId, memberId]))
	})

	describe('getSceneFolderDescendantIds', () => {
		it('walks the whole subtree, not just the direct children', async () => {
			const ids = await repository.getSceneFolderDescendantIds(rootId)

			expect(new Set(ids)).toEqual(new Set([branchId, leafId]))
		})

		it('returns nothing for a leaf', async () => {
			expect(await repository.getSceneFolderDescendantIds(leafId)).toEqual([])
		})

		it('excludes siblings', async () => {
			expect(await repository.getSceneFolderDescendantIds(siblingId)).toEqual(
				[]
			)
		})
	})

	describe('moveSceneFolder', () => {
		it('rejects a move into its own descendant', async () => {
			await expect(
				repository.moveSceneFolder(rootId, ownerId, leafId)
			).rejects.toThrow(/own subfolders/)
		})

		it('rejects a move into itself', async () => {
			await expect(
				repository.moveSceneFolder(rootId, ownerId, rootId)
			).rejects.toThrow(/into itself/)
		})

		it('lets a member reorganize a folder they did not create', async () => {
			// Move is not destructive, so the table grants it to members. Delete is
			// the one that tightens - see the delete case below.
			await repository.moveSceneFolder(branchId, memberId, siblingId)

			const [row] = await db
				.select({ parentFolderId: schema.sceneFolders.parentFolderId })
				.from(schema.sceneFolders)
				.where(eq(schema.sceneFolders.id, branchId))
			expect(row.parentFolderId).toBe(siblingId)

			await repository.moveSceneFolder(branchId, ownerId, rootId)
		})

		it('reparents a subtree and carries its scenes with it', async () => {
			await repository.moveSceneFolder(branchId, ownerId, siblingId)

			const [branch] = await db
				.select({ parentFolderId: schema.sceneFolders.parentFolderId })
				.from(schema.sceneFolders)
				.where(eq(schema.sceneFolders.id, branchId))
			expect(branch.parentFolderId).toBe(siblingId)

			// The leaf still hangs off the branch, and its scene never moved.
			const [leaf] = await db
				.select({ parentFolderId: schema.sceneFolders.parentFolderId })
				.from(schema.sceneFolders)
				.where(eq(schema.sceneFolders.id, leafId))
			expect(leaf.parentFolderId).toBe(branchId)

			const [scene] = await db
				.select({ folderId: schema.scenes.folderId })
				.from(schema.scenes)
				.where(eq(schema.scenes.id, leafSceneId))
			expect(scene.folderId).toBe(leafId)

			// Put it back so the delete case below still has the original shape.
			await repository.moveSceneFolder(branchId, ownerId, rootId)
		})

		it('treats a move to where it already is as a no-op', async () => {
			await expect(
				repository.moveSceneFolder(branchId, ownerId, rootId)
			).resolves.toBeUndefined()
		})
	})

	describe('moveScene', () => {
		it('moves a scene to the project root', async () => {
			await repository.moveScene(rootSceneId, ownerId, null)

			const [scene] = await db
				.select({ folderId: schema.scenes.folderId })
				.from(schema.scenes)
				.where(eq(schema.scenes.id, rootSceneId))
			expect(scene.folderId).toBeNull()
		})

		it('moves a scene into a folder', async () => {
			await repository.moveScene(rootSceneId, ownerId, rootId)

			const [scene] = await db
				.select({ folderId: schema.scenes.folderId })
				.from(schema.scenes)
				.where(eq(schema.scenes.id, rootSceneId))
			expect(scene.folderId).toBe(rootId)
		})

		it('lets a member move a scene', async () => {
			await expect(
				repository.moveScene(rootSceneId, memberId, null)
			).resolves.toBeUndefined()
			await repository.moveScene(rootSceneId, ownerId, rootId)
		})

		it('rejects a cross-project destination at the repository', async () => {
			const foreignFolderId = randomUUID()
			await db.insert(schema.sceneFolders).values({
				id: foreignFolderId,
				projectId: otherProjectId,
				name: 'foreign',
				ownerId,
				parentFolderId: null
			})

			await expect(
				repository.moveScene(rootSceneId, ownerId, foreignFolderId)
			).rejects.toThrow(/between projects/)
		})
	})

	describe('loadDashboardEntityRefs', () => {
		it('counts a folder as non-empty when it holds anything', async () => {
			const loaded = await loadDashboardEntityRefs(
				[{ type: 'folder', id: rootId }],
				ownerId
			)

			// One subfolder plus one scene.
			expect(loaded.get(rootId)?.ref.childCount).toBe(2)
		})

		it('reads a published scene as published', async () => {
			const loaded = await loadDashboardEntityRefs(
				[{ type: 'scene', id: publishedSceneId }],
				ownerId
			)

			expect(loaded.get(publishedSceneId)?.ref.sceneStatus).toBe('published')
		})

		it('marks the folder creator as the resource owner', async () => {
			const loaded = await loadDashboardEntityRefs(
				[{ type: 'folder', id: rootId }],
				ownerId
			)

			expect(loaded.get(rootId)?.isResourceOwner).toBe(true)
			expect(loaded.get(rootId)?.role).toBe('owner')
		})
	})

	describe('deleteScene', () => {
		it('hands back the published asset instead of stranding it', async () => {
			const { orphanedAssetIds } = await repository.deleteScene(
				publishedSceneId,
				ownerId,
				{ deferAssetCleanup: true }
			)

			expect(orphanedAssetIds).toEqual([publishedAssetId])

			const remaining = await db
				.select({ id: schema.scenes.id })
				.from(schema.scenes)
				.where(eq(schema.scenes.id, publishedSceneId))
			expect(remaining).toHaveLength(0)
		})
	})

	describe('deleteSceneFolder', () => {
		it('refuses a member who did not create the folder, and changes nothing', async () => {
			// The privilege this whole change tightens. Before it, this succeeded.
			await expect(
				repository.deleteSceneFolder(rootId, memberId)
			).rejects.toThrow()

			const survivors = await db
				.select({ id: schema.sceneFolders.id })
				.from(schema.sceneFolders)
				.where(inArray(schema.sceneFolders.id, [rootId, branchId, leafId]))
			expect(survivors).toHaveLength(3)
		})

		it('deletes the subtree and reparents its scenes to the project root', async () => {
			await repository.deleteSceneFolder(rootId, ownerId)

			const survivors = await db
				.select({ id: schema.sceneFolders.id })
				.from(schema.sceneFolders)
				.where(
					inArray(schema.sceneFolders.id, [rootId, branchId, leafId, siblingId])
				)

			// Only the sibling, which was never under `root`, is left.
			expect(survivors.map((row) => row.id)).toEqual([siblingId])

			const scenes = await db
				.select({ id: schema.scenes.id, folderId: schema.scenes.folderId })
				.from(schema.scenes)
				.where(inArray(schema.scenes.id, [leafSceneId, rootSceneId]))

			expect(scenes).toHaveLength(2)
			for (const scene of scenes) {
				expect(scene.folderId).toBeNull()
			}
		})
	})
})
