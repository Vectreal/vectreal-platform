import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../db/client'
import { organizationMemberships } from '../../db/schema/core/organization-memberships'
import { projects } from '../../db/schema/project/projects'

/**
 * Service for project-related database operations.
 */
export class ProjectService {
	private readonly db = getDbClient()

	/**
	 * Gets all projects for organizations where the user is a member.
	 * @param userId - The user ID
	 * @returns Array of projects with organization info
	 */
	async getUserProjects(userId: string): Promise<
		Array<{
			project: typeof projects.$inferSelect
			organizationId: string
		}>
	> {
		return await this.db
			.select({
				project: projects,
				organizationId: projects.organizationId
			})
			.from(projects)
			.innerJoin(
				organizationMemberships,
				eq(organizationMemberships.organizationId, projects.organizationId)
			)
			.where(eq(organizationMemberships.userId, userId))
	}

	/**
	 * Gets projects for a specific organization.
	 * @param organizationId - The organization ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of projects
	 */
	async getOrganizationProjects(
		organizationId: string,
		userId: string
	): Promise<Array<typeof projects.$inferSelect>> {
		// First verify user has access to the organization
		const membership = await this.db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.userId, userId),
					eq(organizationMemberships.organizationId, organizationId)
				)
			)
			.limit(1)

		if (membership.length === 0) {
			throw new Error('User does not have access to this organization')
		}

		return await this.db
			.select()
			.from(projects)
			.where(eq(projects.organizationId, organizationId))
	}

	/**
	 * Gets a specific project by ID.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 * @returns Project record or null if not found/no access
	 */
	async getProject(
		projectId: string,
		userId: string
	): Promise<typeof projects.$inferSelect | null> {
		const result = await this.db
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

		return result[0]?.project || null
	}

	/**
	 * Creates a new project in an organization.
	 * @param organizationId - The organization ID
	 * @param name - The project name
	 * @param slug - The project slug
	 * @param userId - The user ID (for permission check)
	 * @returns Created project record
	 */
	async createProject(
		organizationId: string,
		name: string,
		slug: string,
		userId: string
	): Promise<typeof projects.$inferSelect> {
		// Verify user has access to create projects in this organization
		const membership = await this.db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.userId, userId),
					eq(organizationMemberships.organizationId, organizationId)
				)
			)
			.limit(1)

		if (membership.length === 0) {
			throw new Error('User does not have access to this organization')
		}

		// Members and above can create projects
		const [newProject] = await this.db
			.insert(projects)
			.values({
				organizationId,
				name,
				slug
			})
			.returning()

		return newProject
	}

	/**
	 * Updates a project.
	 * @param projectId - The project ID
	 * @param updates - The updates to apply
	 * @param userId - The user ID (for permission check)
	 * @returns Updated project record
	 */
	async updateProject(
		projectId: string,
		updates: Partial<Pick<typeof projects.$inferSelect, 'name' | 'slug'>>,
		userId: string
	): Promise<typeof projects.$inferSelect> {
		// First verify user has edit permissions
		const result = await this.db
			.select({
				project: projects,
				membership: organizationMemberships
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

		const { project, membership } = result[0] || {}

		if (!project || !membership) {
			throw new Error('Project not found or access denied')
		}

		// Only admin and owner can edit projects
		if (!['admin', 'owner'].includes(membership.role)) {
			throw new Error('Insufficient permissions to edit this project')
		}

		const [updatedProject] = await this.db
			.update(projects)
			.set(updates)
			.where(eq(projects.id, projectId))
			.returning()

		return updatedProject
	}

	/**
	 * Deletes a project.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 */
	async deleteProject(projectId: string, userId: string): Promise<void> {
		// First verify user has delete permissions
		const result = await this.db
			.select({
				project: projects,
				membership: organizationMemberships
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

		const { project, membership } = result[0] || {}

		if (!project || !membership) {
			throw new Error('Project not found or access denied')
		}

		// Only owner can delete projects
		if (membership.role !== 'owner') {
			throw new Error('Only organization owners can delete projects')
		}

		await this.db.delete(projects).where(eq(projects.id, projectId))
	}
}

export const projectService = new ProjectService()
