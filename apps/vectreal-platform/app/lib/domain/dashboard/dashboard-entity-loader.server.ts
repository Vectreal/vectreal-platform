/**
 * Reads the current server-side state of dashboard entities, plus the actor's
 * authority over each one.
 *
 * Separate from the executor on purpose. Nothing the client says about *state*
 * is trusted - publish status, folder contents and scene counts are all read
 * here, from the database, and the confirmation tier is recomputed from what
 * this returns. Keeping the reads in their own module leaves the executor
 * testable without a database behind it.
 */

import { and, count, eq, inArray, isNotNull } from 'drizzle-orm'

import { type DashboardEntityRef } from './dashboard-confirmation'
import { type DashboardMutationTarget } from './dashboard-mutations'
import {
	type DashboardEntityType,
	type MembershipRole
} from './dashboard-operations'
import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { projects } from '../../../db/schema/project/projects'
import { sceneFolders } from '../../../db/schema/project/scene-folders'
import { scenePublished } from '../../../db/schema/project/scene-published'
import { scenes } from '../../../db/schema/project/scenes'
import { getSceneFolderChildCounts } from '../scene/server/scene-folder-repository.server'

const db = getDbClient()

/** An entity ref as the *server* knows it, plus the actor's authority over it. */
export interface LoadedEntity {
	ref: DashboardEntityRef
	role: MembershipRole
	isResourceOwner: boolean
}

async function loadSceneEntities(
	ids: string[],
	userId: string
): Promise<Map<string, LoadedEntity>> {
	if (ids.length === 0) {
		return new Map()
	}

	const rows = await db
		.select({
			id: scenes.id,
			name: scenes.name,
			status: scenes.status,
			projectId: scenes.projectId,
			folderId: scenes.folderId,
			role: organizationMemberships.role,
			publishedSceneId: scenePublished.sceneId
		})
		.from(scenes)
		.innerJoin(projects, eq(projects.id, scenes.projectId))
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.leftJoin(scenePublished, eq(scenePublished.sceneId, scenes.id))
		.where(
			and(inArray(scenes.id, ids), eq(organizationMemberships.userId, userId))
		)

	return new Map(
		rows.map((row) => [
			row.id,
			{
				ref: {
					type: 'scene' as const,
					id: row.id,
					name: row.name,
					projectId: row.projectId,
					folderId: row.folderId,
					// `scenes.status` and `scene_published` can drift apart when a
					// revoke fails halfway. Either one saying "published" is enough to
					// earn the stricter confirmation.
					sceneStatus:
						row.status === 'published' || row.publishedSceneId !== null
							? ('published' as const)
							: row.status
				},
				role: row.role,
				isResourceOwner: false
			}
		])
	)
}

async function loadFolderEntities(
	ids: string[],
	userId: string
): Promise<Map<string, LoadedEntity>> {
	if (ids.length === 0) {
		return new Map()
	}

	const rows = await db
		.select({
			id: sceneFolders.id,
			name: sceneFolders.name,
			projectId: sceneFolders.projectId,
			parentFolderId: sceneFolders.parentFolderId,
			ownerId: sceneFolders.ownerId,
			role: organizationMemberships.role
		})
		.from(sceneFolders)
		.innerJoin(projects, eq(projects.id, sceneFolders.projectId))
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(
				inArray(sceneFolders.id, ids),
				eq(organizationMemberships.userId, userId)
			)
		)

	if (rows.length === 0) {
		return new Map()
	}

	// Same counts the content tables ship to the dialog, from the same query, so
	// the tier the server decides on cannot drift from the one it rendered.
	const childTotals = await getSceneFolderChildCounts(rows.map((row) => row.id))

	return new Map(
		rows.map((row) => [
			row.id,
			{
				ref: {
					type: 'folder' as const,
					id: row.id,
					name: row.name,
					projectId: row.projectId,
					folderId: row.parentFolderId,
					childCount: childTotals.get(row.id) ?? 0
				},
				role: row.role,
				isResourceOwner: row.ownerId === userId
			}
		])
	)
}

async function loadProjectEntities(
	ids: string[],
	userId: string
): Promise<Map<string, LoadedEntity>> {
	if (ids.length === 0) {
		return new Map()
	}

	const rows = await db
		.select({
			id: projects.id,
			name: projects.name,
			role: organizationMemberships.role
		})
		.from(projects)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(inArray(projects.id, ids), eq(organizationMemberships.userId, userId))
		)

	if (rows.length === 0) {
		return new Map()
	}

	const foundIds = rows.map((row) => row.id)

	const [sceneTotals, publishedTotals] = await Promise.all([
		db
			.select({ projectId: scenes.projectId, total: count() })
			.from(scenes)
			.where(inArray(scenes.projectId, foundIds))
			.groupBy(scenes.projectId),
		db
			.select({ projectId: scenes.projectId, total: count() })
			.from(scenes)
			.innerJoin(scenePublished, eq(scenePublished.sceneId, scenes.id))
			.where(
				and(
					inArray(scenes.projectId, foundIds),
					isNotNull(scenePublished.sceneId)
				)
			)
			.groupBy(scenes.projectId)
	])

	const sceneCountById = new Map(
		sceneTotals.map((row) => [row.projectId, row.total])
	)
	const publishedById = new Map(
		publishedTotals.map((row) => [row.projectId, row.total])
	)

	return new Map(
		rows.map((row) => [
			row.id,
			{
				ref: {
					type: 'project' as const,
					id: row.id,
					name: row.name,
					projectId: null,
					sceneCount: sceneCountById.get(row.id) ?? 0,
					publishedCount: publishedById.get(row.id) ?? 0
				},
				role: row.role,
				isResourceOwner: false
			}
		])
	)
}

/**
 * Resolves every target to its current server-side state and the actor's role
 * over it, in one batched read per entity type.
 *
 * Targets the user cannot see are simply absent from the result - the caller
 * turns those into `not-found`, which is deliberately the same answer as
 * "exists but not yours".
 */
export async function loadDashboardEntityRefs(
	targets: readonly DashboardMutationTarget[],
	userId: string
): Promise<Map<string, LoadedEntity>> {
	const idsByType: Record<DashboardEntityType, string[]> = {
		scene: [],
		folder: [],
		project: []
	}
	for (const target of targets) {
		idsByType[target.type].push(target.id)
	}

	const [sceneEntities, folderEntities, projectEntities] = await Promise.all([
		loadSceneEntities(idsByType.scene, userId),
		loadFolderEntities(idsByType.folder, userId),
		loadProjectEntities(idsByType.project, userId)
	])

	return new Map([...sceneEntities, ...folderEntities, ...projectEntities])
}
