import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { getDbClient } from '../../../../db/client'
import { organizationMemberships } from '../../../../db/schema/core/organization-memberships'
import { projects } from '../../../../db/schema/project/projects'
import { sceneAssets } from '../../../../db/schema/project/scene-assets'
import { sceneFolders } from '../../../../db/schema/project/scene-folders'
import { scenePublished } from '../../../../db/schema/project/scene-published'
import { sceneSettings } from '../../../../db/schema/project/scene-settings'
import { scenes } from '../../../../db/schema/project/scenes'
import {
	deleteAssets,
	selectUnreferencedAssetIds
} from '../../asset/asset-storage.server'
import {
	getQuotaLimit,
	getRecommendedUpgrade
} from '../../billing/entitlement-service.server'
import { QuotaExceededError } from '../../billing/quota-exceeded-error'
import {
	assertDashboardPermission,
	resolveProjectMembership,
	resolveSceneFolderMembership,
	resolveSceneMembership
} from '../../dashboard/dashboard-permissions.server'
import {
	FOLDER_RULE_MESSAGES,
	MAX_FOLDER_DEPTH,
	validateFolderMove,
	validateSceneMove
} from '../../dashboard/folder-move'

import type {
	SceneLocationFolderOption,
	SceneMetadataUpdateInput
} from '../../../../types/api'

const db = getDbClient()

type DbClient = typeof db

async function getSceneFolderById(
	folderId: string
): Promise<typeof sceneFolders.$inferSelect | null> {
	const [folder] = await db
		.select()
		.from(sceneFolders)
		.where(eq(sceneFolders.id, folderId))
		.limit(1)

	return folder ?? null
}

async function verifyProjectAccess(
	dbClient: DbClient,
	projectId: string,
	userId: string
): Promise<void> {
	const result = await dbClient
		.select({
			project: projects
		})
		.from(projects)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(
				eq(projects.id, projectId),
				eq(organizationMemberships.userId, userId)
			)
		)
		.limit(1)

	if (result.length === 0) {
		throw new Error('User does not have access to this project')
	}
}

export async function getProjectScenes(
	projectId: string,
	userId: string
): Promise<Array<typeof scenes.$inferSelect>> {
	await verifyProjectAccess(db, projectId, userId)

	return await db
		.select()
		.from(scenes)
		.where(eq(scenes.projectId, projectId))
		.orderBy(desc(scenes.updatedAt))
}

export async function getProjectsScenes(
	projectIds: string[],
	userId: string
): Promise<Map<string, Array<typeof scenes.$inferSelect>>> {
	if (projectIds.length === 0) {
		return new Map()
	}

	const allScenes = await db
		.select({
			scene: scenes
		})
		.from(scenes)
		.innerJoin(projects, eq(projects.id, scenes.projectId))
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(
				inArray(scenes.projectId, projectIds),
				eq(organizationMemberships.userId, userId)
			)
		)
		.orderBy(desc(scenes.updatedAt))

	const scenesByProject = new Map<string, Array<typeof scenes.$inferSelect>>()

	for (const projectId of projectIds) {
		scenesByProject.set(projectId, [])
	}

	for (const { scene } of allScenes) {
		const projectScenes = scenesByProject.get(scene.projectId)
		if (projectScenes) {
			projectScenes.push(scene)
		}
	}

	return scenesByProject
}

export async function getScene(
	sceneId: string,
	userId: string
): Promise<typeof scenes.$inferSelect | null> {
	const [scene] = await db
		.select()
		.from(scenes)
		.where(eq(scenes.id, sceneId))
		.limit(1)

	if (!scene) {
		return null
	}

	await verifyProjectAccess(db, scene.projectId, userId)

	return scene
}

export async function getFolderScenes(
	folderId: string,
	userId: string
): Promise<Array<typeof scenes.$inferSelect>> {
	const folder = await getSceneFolder(folderId, userId)
	if (!folder) {
		throw new Error('Folder not found or access denied')
	}

	return await db
		.select()
		.from(scenes)
		.where(eq(scenes.folderId, folderId))
		.orderBy(desc(scenes.updatedAt))
}

export async function getRootScenes(
	projectId: string,
	userId: string
): Promise<Array<typeof scenes.$inferSelect>> {
	await verifyProjectAccess(db, projectId, userId)

	return await db
		.select()
		.from(scenes)
		.where(and(eq(scenes.projectId, projectId), isNull(scenes.folderId)))
		.orderBy(desc(scenes.updatedAt))
}

/**
 * Resolves the depth of a folder by walking its parentFolderId chain.
 * Memoises results in depthMap to avoid redundant traversal.
 * Guards against cycles with a visited set.
 */
function resolveFolderDepth(
	id: string,
	parentMap: Map<string, string | null>,
	depthMap: Map<string, number>,
	visited = new Set<string>()
): number {
	if (depthMap.has(id)) return depthMap.get(id)!
	if (visited.has(id)) return 0 // cycle guard
	visited.add(id)
	const parentId = parentMap.get(id) ?? null
	const depth =
		parentId === null
			? 0
			: resolveFolderDepth(parentId, parentMap, depthMap, visited) + 1
	depthMap.set(id, depth)
	return depth
}

export async function getSceneFolderTree(
	projectId: string,
	userId: string
): Promise<SceneLocationFolderOption[]> {
	await verifyProjectAccess(db, projectId, userId)

	const rows = await db
		.select({
			id: sceneFolders.id,
			name: sceneFolders.name,
			parentFolderId: sceneFolders.parentFolderId
		})
		.from(sceneFolders)
		.where(eq(sceneFolders.projectId, projectId))
		.orderBy(sceneFolders.name)

	// Compute depth by walking parentFolderId references in memory (single query)
	const depthMap = new Map<string, number>()
	const parentMap = new Map<string, string | null>(
		rows.map((r) => [r.id, r.parentFolderId])
	)

	for (const row of rows) {
		resolveFolderDepth(row.id, parentMap, depthMap)
	}

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		parentFolderId: r.parentFolderId,
		depth: depthMap.get(r.id) ?? 0
	}))
}

export async function getRootSceneFolders(
	projectId: string,
	userId: string
): Promise<Array<typeof sceneFolders.$inferSelect>> {
	await verifyProjectAccess(db, projectId, userId)

	return await db
		.select()
		.from(sceneFolders)
		.where(
			and(
				eq(sceneFolders.projectId, projectId),
				isNull(sceneFolders.parentFolderId)
			)
		)
		.orderBy(desc(sceneFolders.updatedAt))
}

export async function getSceneFolder(
	folderId: string,
	userId: string
): Promise<typeof sceneFolders.$inferSelect | null> {
	const folder = await getSceneFolderById(folderId)

	if (!folder) {
		return null
	}

	await verifyProjectAccess(db, folder.projectId, userId)

	return folder
}

export async function getSceneFolderAncestry(
	folderId: string,
	userId: string
): Promise<Array<typeof sceneFolders.$inferSelect>> {
	const ancestry: Array<typeof sceneFolders.$inferSelect> = []
	const visitedFolderIds = new Set<string>()

	const initialFolder = await getSceneFolderById(folderId)
	if (!initialFolder) {
		return ancestry
	}

	await verifyProjectAccess(db, initialFolder.projectId, userId)

	let currentFolderId: string | null = initialFolder.id
	let depth = 0

	while (currentFolderId) {
		if (visitedFolderIds.has(currentFolderId)) {
			throw new Error('Cycle detected in folder hierarchy')
		}

		visitedFolderIds.add(currentFolderId)

		const folder = await getSceneFolderById(currentFolderId)
		if (!folder) {
			break
		}

		if (folder.projectId !== initialFolder.projectId) {
			throw new Error('Invalid folder ancestry across projects')
		}

		ancestry.push(folder)
		currentFolderId = folder.parentFolderId
		depth += 1

		if (depth > MAX_FOLDER_DEPTH) {
			throw new Error('Folder hierarchy exceeds supported depth')
		}
	}

	return ancestry.reverse()
}

/**
 * Every folder beneath `folderId`, at any depth.
 *
 * The counterpart to `getSceneFolderAncestry`, which walks the other way and
 * costs one query per level. This is a single recursive CTE because both
 * callers - recursive delete and the move cycle guard - need the whole subtree
 * at once.
 *
 * `parent_folder_id` has no CHECK constraint against cycles, so a corrupt row
 * could otherwise make the CTE loop forever. The depth column bounds it at the
 * same limit the ancestry walk enforces, and `distinct` collapses whatever a
 * cycle managed to emit before hitting the cap.
 *
 * Access is not checked here: it is an internal helper, and both callers verify
 * permission on the subtree root, which is the only way to reach any of these.
 */
export async function getSceneFolderDescendantIds(
	folderId: string
): Promise<string[]> {
	const result = await db.execute(sql`
		with recursive descendants (id, depth) as (
			select id, 1
			from scene_folders
			where parent_folder_id = ${folderId}::uuid
			union all
			select child.id, parent.depth + 1
			from scene_folders child
			join descendants parent on child.parent_folder_id = parent.id
			where parent.depth < ${MAX_FOLDER_DEPTH}
		)
		select distinct id from descendants
	`)

	const rows = result as unknown as Array<{ id: string }>

	return rows.map((row) => row.id)
}

/**
 * How many scenes and immediate subfolders each of these folders holds.
 *
 * The delete confirmation treats an unknown child count as "not empty" and
 * escalates to a typed confirmation, so a content table that omitted this would
 * make every folder delete demand typing `DELETE`. Two grouped queries rather
 * than two per folder.
 */
export async function getSceneFolderChildCounts(
	folderIds: string[]
): Promise<Map<string, number>> {
	const totals = new Map<string, number>()
	if (folderIds.length === 0) {
		return totals
	}

	for (const folderId of folderIds) {
		totals.set(folderId, 0)
	}

	const [sceneCounts, subfolderCounts] = await Promise.all([
		db
			.select({ folderId: scenes.folderId, total: count() })
			.from(scenes)
			.where(inArray(scenes.folderId, folderIds))
			.groupBy(scenes.folderId),
		db
			.select({ parentFolderId: sceneFolders.parentFolderId, total: count() })
			.from(sceneFolders)
			.where(inArray(sceneFolders.parentFolderId, folderIds))
			.groupBy(sceneFolders.parentFolderId)
	])

	for (const row of sceneCounts) {
		if (row.folderId) {
			totals.set(row.folderId, (totals.get(row.folderId) ?? 0) + row.total)
		}
	}
	for (const row of subfolderCounts) {
		if (row.parentFolderId) {
			totals.set(
				row.parentFolderId,
				(totals.get(row.parentFolderId) ?? 0) + row.total
			)
		}
	}

	return totals
}

export async function getChildFolders(
	parentFolderId: string,
	userId: string
): Promise<Array<typeof sceneFolders.$inferSelect>> {
	const parentFolder = await getSceneFolder(parentFolderId, userId)
	if (!parentFolder) {
		throw new Error('Parent folder not found or access denied')
	}

	return await db
		.select()
		.from(sceneFolders)
		.where(eq(sceneFolders.parentFolderId, parentFolderId))
		.orderBy(desc(sceneFolders.updatedAt))
}

export async function getAccessibleSceneFolders(
	userId: string
): Promise<Array<typeof sceneFolders.$inferSelect>> {
	const rows = await db
		.select({ folder: sceneFolders })
		.from(sceneFolders)
		.innerJoin(projects, eq(projects.id, sceneFolders.projectId))
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(eq(organizationMemberships.userId, userId))
		.orderBy(desc(sceneFolders.updatedAt))

	return rows.map(({ folder }) => folder)
}

/**
 * Rejects folder creation once an organization is at its plan limit.
 *
 * Counts rows rather than going through `checkQuota`. That helper reads
 * `org_usage_counters`, and nothing in the app calls `incrementUsage` or
 * `decrementUsage` - every counter except a leftover `optimization_runs_per_month`
 * sits at zero, so `checkQuota` can never report an exceeded limit. Routing this
 * through it would look like enforcement and enforce nothing.
 *
 * `getQuotaLimit` is used as-is: the limit side reads plan config and per-org
 * overrides, and works. It is only the usage side that is inert.
 */
async function assertFolderQuota(organizationId: string): Promise<void> {
	const { limit, effectivePlan } = await getQuotaLimit(
		organizationId,
		'folders_total'
	)

	if (limit === null) {
		return
	}

	const [row] = await db
		.select({ total: count() })
		.from(sceneFolders)
		.innerJoin(projects, eq(projects.id, sceneFolders.projectId))
		.where(eq(projects.organizationId, organizationId))

	const current = row?.total ?? 0
	if (current + 1 <= limit) {
		return
	}

	throw new QuotaExceededError({
		limitKey: 'folders_total',
		currentValue: current,
		limit,
		plan: effectivePlan,
		upgradeTo: getRecommendedUpgrade(effectivePlan),
		message: `Folder limit reached for your plan (${limit}). Delete a folder or upgrade to create more.`
	})
}

export async function createSceneFolder(params: {
	projectId: string
	userId: string
	name: string
	description?: string | null
	parentFolderId?: string | null
}): Promise<typeof sceneFolders.$inferSelect> {
	const trimmedName = params.name.trim()
	if (!trimmedName) {
		throw new Error('Folder name is required')
	}

	const membership = await resolveProjectMembership(
		params.projectId,
		params.userId
	)
	if (!membership) {
		throw new Error('User does not have access to this project')
	}
	assertDashboardPermission('scene-folder:create', membership)

	await assertFolderQuota(membership.organizationId)

	if (params.parentFolderId) {
		const parentFolder = await getSceneFolder(
			params.parentFolderId,
			params.userId
		)
		if (!parentFolder) {
			throw new Error('Parent folder not found or access denied')
		}

		if (parentFolder.projectId !== params.projectId) {
			throw new Error('Parent folder must belong to the same project')
		}

		/*
		  Create was the one path that could deepen the tree without a limit, while
		  reads throw past the cap - so a folder nested past it became unreadable
		  and took the whole tree view down with it. Move has always validated this;
		  now both use the same rule and the same message.
		*/
		const tree = await getSceneFolderTree(params.projectId, params.userId)
		const parentDepth = tree.find(
			(entry) => entry.id === params.parentFolderId
		)?.depth
		const resultingDepth = (parentDepth ?? 0) + 1
		if (resultingDepth > MAX_FOLDER_DEPTH) {
			throw new Error(FOLDER_RULE_MESSAGES['too-deep'])
		}
	}

	const [folder] = await db
		.insert(sceneFolders)
		.values({
			projectId: params.projectId,
			name: trimmedName,
			description: params.description?.trim() || null,
			ownerId: params.userId,
			parentFolderId: params.parentFolderId || null,
			updatedAt: new Date()
		})
		.returning()

	if (!folder) {
		throw new Error('Failed to create folder')
	}

	return folder
}

export async function renameScene(
	sceneId: string,
	userId: string,
	name: string
): Promise<typeof scenes.$inferSelect> {
	const trimmedName = name.trim()
	if (!trimmedName) {
		throw new Error('Scene name is required')
	}

	const membership = await resolveSceneMembership(sceneId, userId)
	if (!membership) {
		throw new Error('Scene not found or access denied')
	}
	assertDashboardPermission('scene:update', membership)

	const [updatedScene] = await db
		.update(scenes)
		.set({ name: trimmedName, updatedAt: new Date() })
		.where(eq(scenes.id, sceneId))
		.returning()

	if (!updatedScene) {
		throw new Error('Failed to rename scene')
	}

	return updatedScene
}

export async function updateSceneMetadata(
	sceneId: string,
	userId: string,
	params: SceneMetadataUpdateInput
): Promise<typeof scenes.$inferSelect> {
	const trimmedName = params.name.trim()
	if (!trimmedName) {
		throw new Error('Scene name is required')
	}

	const membership = await resolveSceneMembership(sceneId, userId)
	if (!membership) {
		throw new Error('Scene not found or access denied')
	}
	assertDashboardPermission('scene:update', membership)

	const [updatedScene] = await db
		.update(scenes)
		.set({
			name: trimmedName,
			description: params.description?.trim() || null,
			thumbnailUrl: params.thumbnailUrl?.trim() || null,
			updatedAt: new Date()
		})
		.where(eq(scenes.id, sceneId))
		.returning()

	if (!updatedScene) {
		throw new Error('Failed to update scene metadata')
	}

	return updatedScene
}

export async function renameSceneFolder(
	folderId: string,
	userId: string,
	name: string
): Promise<typeof sceneFolders.$inferSelect> {
	const trimmedName = name.trim()
	if (!trimmedName) {
		throw new Error('Folder name is required')
	}

	const membership = await resolveSceneFolderMembership(folderId, userId)
	if (!membership) {
		throw new Error('Folder not found or access denied')
	}
	assertDashboardPermission('scene-folder:update', membership)

	const [updatedFolder] = await db
		.update(sceneFolders)
		.set({ name: trimmedName, updatedAt: new Date() })
		.where(eq(sceneFolders.id, folderId))
		.returning()

	if (!updatedFolder) {
		throw new Error('Failed to rename folder')
	}

	return updatedFolder
}

/**
 * Moves a scene to another folder within its own project.
 *
 * Cross-project moves are rejected here rather than merely hidden in the UI:
 * a scene's assets live in the project's `folders` tree, so relocating the row
 * alone would orphan them and make the next save fail
 * `assertAssetsBelongToProject`. The publisher owns that flow, because it can
 * re-upload the assets into the destination.
 *
 * @param targetFolderId Null moves the scene to the project root.
 */
export async function moveScene(
	sceneId: string,
	userId: string,
	targetFolderId: string | null
): Promise<void> {
	const membership = await resolveSceneMembership(sceneId, userId)
	if (!membership) {
		throw new Error('Scene not found or access denied')
	}
	assertDashboardPermission('scene:move', membership)

	const [scene] = await db
		.select({ folderId: scenes.folderId, projectId: scenes.projectId })
		.from(scenes)
		.where(eq(scenes.id, sceneId))
		.limit(1)

	if (!scene) {
		throw new Error('Scene not found or access denied')
	}

	let targetIsCrossProject = false
	if (targetFolderId !== null) {
		const targetFolder = await getSceneFolderById(targetFolderId)
		if (!targetFolder) {
			throw new Error('Target folder not found')
		}
		targetIsCrossProject = targetFolder.projectId !== scene.projectId
	}

	const validation = validateSceneMove({
		currentFolderId: scene.folderId,
		targetFolderId,
		targetIsCrossProject
	})

	if (!validation.ok) {
		// A no-op is not a failure; the caller asked for a state that already holds.
		if (validation.reason === 'same-parent') {
			return
		}
		throw new Error(validation.message)
	}

	await db
		.update(scenes)
		.set({ folderId: targetFolderId, updatedAt: new Date() })
		.where(eq(scenes.id, sceneId))
}

/**
 * Reparents a folder within its own project, carrying its scenes and subfolders
 * with it.
 *
 * Nothing writes `parent_folder_id` after creation anywhere else in the
 * codebase, so this is the only path that can introduce a cycle - see
 * `validateFolderMove` for why that matters.
 *
 * @param targetParentFolderId Null moves the folder to the project root.
 */
export async function moveSceneFolder(
	folderId: string,
	userId: string,
	targetParentFolderId: string | null
): Promise<void> {
	const membership = await resolveSceneFolderMembership(folderId, userId)
	if (!membership) {
		throw new Error('Folder not found or access denied')
	}
	assertDashboardPermission('scene-folder:move', membership)

	const folder = await getSceneFolderById(folderId)
	if (!folder) {
		throw new Error('Folder not found or access denied')
	}

	let targetIsCrossProject = false
	if (targetParentFolderId !== null) {
		const targetParent = await getSceneFolderById(targetParentFolderId)
		if (!targetParent) {
			throw new Error('Target folder not found')
		}
		targetIsCrossProject = targetParent.projectId !== folder.projectId
	}

	const [descendantIds, tree] = await Promise.all([
		getSceneFolderDescendantIds(folderId),
		getSceneFolderTree(folder.projectId, userId)
	])

	const validation = validateFolderMove({
		folderId,
		currentParentId: folder.parentFolderId,
		targetParentId: targetParentFolderId,
		descendantIds: new Set(descendantIds),
		depthById: new Map(tree.map((entry) => [entry.id, entry.depth])),
		targetIsCrossProject
	})

	if (!validation.ok) {
		if (validation.reason === 'same-parent') {
			return
		}
		throw new Error(validation.message)
	}

	await db
		.update(sceneFolders)
		.set({ parentFolderId: targetParentFolderId, updatedAt: new Date() })
		.where(eq(sceneFolders.id, folderId))
}

/**
 * Every asset this scene points at, from both directions.
 *
 * Assets reach a scene two ways: through `scene_settings -> scene_assets` for
 * everything it uploaded, and through `scene_published` for the live GLB. Both
 * join rows cascade away with the scene, so this has to run *before* the delete
 * or there is nothing left to look up.
 *
 * These are candidates, not orphans - see `selectUnreferencedAssets`.
 */
async function collectSceneAssetIds(sceneId: string): Promise<string[]> {
	const [attached, published] = await Promise.all([
		db
			.selectDistinct({ assetId: sceneAssets.assetId })
			.from(sceneAssets)
			.innerJoin(
				sceneSettings,
				eq(sceneSettings.id, sceneAssets.sceneSettingsId)
			)
			.where(eq(sceneSettings.sceneId, sceneId)),
		db
			.select({ assetId: scenePublished.assetId })
			.from(scenePublished)
			.where(eq(scenePublished.sceneId, sceneId))
	])

	return [
		...new Set([
			...attached.map((row) => row.assetId),
			...published.map((row) => row.assetId)
		])
	]
}

/**
 * @param options.deferAssetCleanup Skip the storage call and hand the orphaned
 * asset ids back instead. Bulk callers set this and delete once at the end:
 * `deleteAssets` is a network round trip, so doing it per scene inside a loop
 * turns a twenty-scene delete into twenty sequential round trips.
 */
export async function deleteScene(
	sceneId: string,
	userId: string,
	options: { deferAssetCleanup?: boolean } = {}
): Promise<{ orphanedAssetIds: string[] }> {
	const membership = await resolveSceneMembership(sceneId, userId)
	if (!membership) {
		throw new Error('Scene not found or access denied')
	}
	assertDashboardPermission('scene:delete', membership)

	// Before the delete: the join rows that name these assets are about to
	// cascade away. Deleting a scene used to leave every one of them behind,
	// still costing storage, and the published GLB still reachable by URL.
	const candidateAssetIds = await collectSceneAssetIds(sceneId)

	await db.delete(scenes).where(eq(scenes.id, sceneId))

	const orphanedAssetIds = await selectUnreferencedAssetIds(candidateAssetIds)

	if (orphanedAssetIds.length > 0 && !options.deferAssetCleanup) {
		try {
			// After the delete and outside any transaction: this is storage network
			// I/O, and the row is already gone. `deleteAssets` guards each asset but
			// not reaching storage in the first place, so a stranded object beats
			// reporting a completed delete as a failure.
			await deleteAssets(orphanedAssetIds)
		} catch (error) {
			console.error(
				`Failed to clean up orphaned assets for scene ${sceneId}:`,
				error
			)
		}
	}

	return { orphanedAssetIds }
}

/**
 * Deletes a folder and every folder beneath it.
 *
 * Scenes are preserved - they move to the project root - but subfolders are
 * not. Previously only the named folder was deleted, and because
 * `parent_folder_id` is `on delete set null`, its subfolders were silently
 * promoted to root rather than removed: a "delete folder" that quietly
 * scattered its contents across the project.
 */
export async function deleteSceneFolder(
	folderId: string,
	userId: string
): Promise<void> {
	const membership = await resolveSceneFolderMembership(folderId, userId)
	if (!membership) {
		throw new Error('Folder not found or access denied')
	}
	// Checked once, on the root of the subtree. Every descendant is reachable
	// only through it and lives in the same project, so the same role applies.
	assertDashboardPermission('scene-folder:delete', membership)

	const descendantIds = await getSceneFolderDescendantIds(folderId)
	const doomedFolderIds = [folderId, ...descendantIds]

	await db.transaction(async (tx) => {
		await tx
			.update(scenes)
			.set({ folderId: null, updatedAt: new Date() })
			.where(inArray(scenes.folderId, doomedFolderIds))

		await tx
			.delete(sceneFolders)
			.where(inArray(sceneFolders.id, doomedFolderIds))
	})
}
