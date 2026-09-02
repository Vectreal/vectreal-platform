/**
 * Resolves the acting user's role for a given dashboard resource, and enforces
 * the permission table against it.
 *
 * Deliberately a leaf in the import graph: it reaches for `db/client` and the
 * schema directly rather than calling `getScene`/`getProject`/`getSceneFolder`,
 * so repositories can depend on it without a cycle.
 *
 * Each resolver is a single join that answers "which organization owns this,
 * and what is my role in that organization" in one round trip. `null` means
 * either the resource does not exist or the user has no membership in its
 * organization - deliberately indistinguishable, so a probe cannot be used to
 * enumerate resource ids.
 */

import { and, eq } from 'drizzle-orm'

import {
	canPerformDashboardOperation,
	DashboardPermissionError,
	type DashboardActorContext,
	type DashboardOperation,
	type MembershipRole
} from './dashboard-operations'
import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { projects } from '../../../db/schema/project/projects'
import { sceneFolders } from '../../../db/schema/project/scene-folders'
import { scenes } from '../../../db/schema/project/scenes'

const db = getDbClient()

export interface ResolvedMembership {
	organizationId: string
	projectId: string
	role: MembershipRole
	/** True when the acting user created the resource. Folders only. */
	isResourceOwner: boolean
}

export async function resolveProjectMembership(
	projectId: string,
	userId: string
): Promise<ResolvedMembership | null> {
	const [row] = await db
		.select({
			organizationId: projects.organizationId,
			role: organizationMemberships.role
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

	if (!row) {
		return null
	}

	return {
		organizationId: row.organizationId,
		projectId,
		role: row.role,
		isResourceOwner: false
	}
}

export async function resolveSceneMembership(
	sceneId: string,
	userId: string
): Promise<ResolvedMembership | null> {
	const [row] = await db
		.select({
			organizationId: projects.organizationId,
			projectId: projects.id,
			role: organizationMemberships.role
		})
		.from(scenes)
		.innerJoin(projects, eq(projects.id, scenes.projectId))
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(eq(scenes.id, sceneId), eq(organizationMemberships.userId, userId))
		)
		.limit(1)

	if (!row) {
		return null
	}

	return {
		organizationId: row.organizationId,
		projectId: row.projectId,
		role: row.role,
		isResourceOwner: false
	}
}

export async function resolveSceneFolderMembership(
	folderId: string,
	userId: string
): Promise<ResolvedMembership | null> {
	const [row] = await db
		.select({
			organizationId: projects.organizationId,
			projectId: projects.id,
			role: organizationMemberships.role,
			ownerId: sceneFolders.ownerId
		})
		.from(sceneFolders)
		.innerJoin(projects, eq(projects.id, sceneFolders.projectId))
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(
				eq(sceneFolders.id, folderId),
				eq(organizationMemberships.userId, userId)
			)
		)
		.limit(1)

	if (!row) {
		return null
	}

	return {
		organizationId: row.organizationId,
		projectId: row.projectId,
		role: row.role,
		// Reproduces the `or isUserSelf(owner_id)` half of the folder RLS
		// policies: a member who created a folder keeps control of it.
		isResourceOwner: row.ownerId === userId
	}
}

/**
 * Throws unless the actor may perform the operation.
 *
 * @throws {DashboardPermissionError} when the role is insufficient.
 */
export function assertDashboardPermission(
	operation: DashboardOperation,
	actor: DashboardActorContext
): void {
	if (!canPerformDashboardOperation(operation, actor)) {
		throw new DashboardPermissionError(operation, actor.role)
	}
}
