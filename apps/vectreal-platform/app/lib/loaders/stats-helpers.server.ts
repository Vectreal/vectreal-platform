import type {
	organizationMemberships,
	organizations,
	projects,
	scenes
} from '../../db/schema'

export interface ProjectStats {
	total: number
	byOrganization: Record<string, number>
}

export interface SceneStats {
	total: number
	byProject: Record<string, number>
	byStatus: {
		draft: number
		published: number
		archived: number
	}
}

export interface OrganizationStats {
	total: number
	owned: number
	admin: number
	member: number
}

/**
 * Computes project statistics from project data.
 */
export function computeProjectStats(
	userProjects: Array<{
		project: typeof projects.$inferSelect
		organizationId: string
	}>
): ProjectStats {
	const byOrganization: Record<string, number> = {}

	for (const { organizationId } of userProjects) {
		byOrganization[organizationId] = (byOrganization[organizationId] || 0) + 1
	}

	return {
		total: userProjects.length,
		byOrganization
	}
}

/**
 * Computes scene statistics from scene data.
 */
export function computeSceneStats(
	allScenes: Array<typeof scenes.$inferSelect>
): SceneStats {
	const byProject: Record<string, number> = {}
	const byStatus = {
		draft: 0,
		published: 0,
		archived: 0
	}

	for (const scene of allScenes) {
		byProject[scene.projectId] = (byProject[scene.projectId] || 0) + 1
		byStatus[scene.status] = (byStatus[scene.status] || 0) + 1
	}

	return {
		total: allScenes.length,
		byProject,
		byStatus
	}
}

/**
 * Computes organization statistics from organization data.
 */
export function computeOrganizationStats(
	userOrganizations: Array<{
		organization: typeof organizations.$inferSelect
		membership: typeof organizationMemberships.$inferSelect
	}>
): OrganizationStats {
	let owned = 0
	let admin = 0
	let member = 0

	for (const { membership } of userOrganizations) {
		switch (membership.role) {
			case 'owner':
				owned++
				break
			case 'admin':
				admin++
				break
			case 'member':
				member++
				break
		}
	}

	return {
		total: userOrganizations.length,
		owned,
		admin,
		member
	}
}

/**
 * Gets the most recent projects.
 * Note: Projects table doesn't have updatedAt, so we return projects as-is (in DB order)
 */
export function getRecentProjects(
	userProjects: Array<{
		project: typeof projects.$inferSelect
		organizationId: string
	}>,
	limit = 5
): Array<{
	project: typeof projects.$inferSelect
	organizationId: string
}> {
	return userProjects.slice(0, limit)
}

/**
 * Gets the most recent scenes (by updatedAt).
 */
export function getRecentScenes(
	allScenes: Array<typeof scenes.$inferSelect>,
	limit = 5
): Array<typeof scenes.$inferSelect> {
	return [...allScenes]
		.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		)
		.slice(0, limit)
}

/**
 * Checks if a user can create projects in an organization.
 */
export function canCreateProjectsInOrganization(
	role: 'owner' | 'admin' | 'member'
): boolean {
	return ['owner', 'admin', 'member'].includes(role)
}

/**
 * Checks if a user can edit projects in an organization.
 */
export function canEditProjectsInOrganization(
	role: 'owner' | 'admin' | 'member'
): boolean {
	return ['owner', 'admin'].includes(role)
}

/**
 * Checks if a user can delete projects in an organization.
 */
export function canDeleteProjectsInOrganization(
	role: 'owner' | 'admin' | 'member'
): boolean {
	return role === 'owner'
}

/**
 * Computes project creation capabilities for all user organizations.
 */
export function computeProjectCreationCapabilities(
	userOrganizations: Array<{
		organization: typeof organizations.$inferSelect
		membership: typeof organizationMemberships.$inferSelect
	}>
): Record<
	string,
	{
		canCreate: boolean
		canEdit: boolean
		canDelete: boolean
	}
> {
	const capabilities: Record<
		string,
		{
			canCreate: boolean
			canEdit: boolean
			canDelete: boolean
		}
	> = {}

	for (const { organization, membership } of userOrganizations) {
		capabilities[organization.id] = {
			canCreate: canCreateProjectsInOrganization(membership.role),
			canEdit: canEditProjectsInOrganization(membership.role),
			canDelete: canDeleteProjectsInOrganization(membership.role)
		}
	}

	return capabilities
}
