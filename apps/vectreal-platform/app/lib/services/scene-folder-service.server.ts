import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { getDbClient } from '../../db/client'
import { organizationMemberships } from '../../db/schema/core/organization-memberships'
import { projects } from '../../db/schema/project/projects'
import { sceneFolders } from '../../db/schema/project/scene-folders'
import { scenes } from '../../db/schema/project/scenes'

/**
 * Service for scene-related database operations.
 */
export class SceneFolderService {
	private readonly db = getDbClient()

	/**
	 * Gets all scenes for a project that the user has access to.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of scenes
	 */
	async getProjectScenes(
		projectId: string,
		userId: string
	): Promise<Array<typeof scenes.$inferSelect>> {
		// First verify user has access to the project
		await this.verifyProjectAccess(projectId, userId)

		return await this.db
			.select()
			.from(scenes)
			.where(eq(scenes.projectId, projectId))
			.orderBy(desc(scenes.updatedAt))
	}

	/**
	 * Gets all scenes for multiple projects in a single query (batch operation).
	 * Eliminates N+1 query pattern when loading scenes for multiple projects.
	 * @param projectIds - Array of project IDs
	 * @param userId - The user ID (for permission check)
	 * @returns Map of projectId -> array of scenes
	 */
	async getProjectsScenes(
		projectIds: string[],
		userId: string
	): Promise<Map<string, Array<typeof scenes.$inferSelect>>> {
		if (projectIds.length === 0) {
			return new Map()
		}

		// Fetch all scenes for all projects in a single query with permission check
		const allScenes = await this.db
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

		// Group scenes by project ID
		const scenesByProject = new Map<string, Array<typeof scenes.$inferSelect>>()

		// Initialize all projects with empty arrays
		for (const projectId of projectIds) {
			scenesByProject.set(projectId, [])
		}

		// Populate with actual scenes
		for (const { scene } of allScenes) {
			const projectScenes = scenesByProject.get(scene.projectId)
			if (projectScenes) {
				projectScenes.push(scene)
			}
		}

		return scenesByProject
	}

	/**
	 * Gets a specific scene by ID.
	 * @param sceneId - The scene ID
	 * @param userId - The user ID (for permission check)
	 * @returns Scene record or null if not found/no access
	 */
	async getScene(
		sceneId: string,
		userId: string
	): Promise<typeof scenes.$inferSelect | null> {
		const result = await this.db
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
				and(eq(scenes.id, sceneId), eq(organizationMemberships.userId, userId))
			)
			.limit(1)

		return result[0]?.scene || null
	}

	/**
	 * Gets scenes in a specific folder.
	 * @param folderId - The folder ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of scenes in the folder
	 */
	async getFolderScenes(
		folderId: string,
		userId: string
	): Promise<Array<typeof scenes.$inferSelect>> {
		// First get the folder to verify access and get project ID
		const folder = await this.getSceneFolder(folderId, userId)
		if (!folder) {
			throw new Error('Folder not found or access denied')
		}

		return await this.db
			.select()
			.from(scenes)
			.where(eq(scenes.folderId, folderId))
			.orderBy(desc(scenes.updatedAt))
	}

	/**
	 * Gets root-level scenes (not in any folder) for a project.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of root-level scenes
	 */
	async getRootScenes(
		projectId: string,
		userId: string
	): Promise<Array<typeof scenes.$inferSelect>> {
		// First verify user has access to the project
		await this.verifyProjectAccess(projectId, userId)

		return await this.db
			.select()
			.from(scenes)
			.where(and(eq(scenes.projectId, projectId), isNull(scenes.folderId)))
			.orderBy(desc(scenes.updatedAt))
	}

	/**
	 * Gets root-level scene folders (no parent) for a project.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of root-level scene folders
	 */
	async getRootSceneFolders(
		projectId: string,
		userId: string
	): Promise<Array<typeof sceneFolders.$inferSelect>> {
		// First verify user has access to the project
		await this.verifyProjectAccess(projectId, userId)

		return await this.db
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

	/**
	 * Gets a specific scene folder by ID.
	 * @param folderId - The folder ID
	 * @param userId - The user ID (for permission check)
	 * @returns Scene folder record or null if not found/no access
	 */
	async getSceneFolder(
		folderId: string,
		userId: string
	): Promise<typeof sceneFolders.$inferSelect | null> {
		const result = await this.db
			.select({
				folder: sceneFolders
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

		return result[0]?.folder || null
	}

	/**
	 * Gets child folders of a parent folder.
	 * @param parentFolderId - The parent folder ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of child folders
	 */
	async getChildFolders(
		parentFolderId: string,
		userId: string
	): Promise<Array<typeof sceneFolders.$inferSelect>> {
		// First verify user has access to the parent folder
		const parentFolder = await this.getSceneFolder(parentFolderId, userId)
		if (!parentFolder) {
			throw new Error('Parent folder not found or access denied')
		}

		return await this.db
			.select()
			.from(sceneFolders)
			.where(eq(sceneFolders.parentFolderId, parentFolderId))
			.orderBy(desc(sceneFolders.updatedAt))
	}

	/**
	 * Verifies that a user has access to a project.
	 * @param projectId - The project ID
	 * @param userId - The user ID
	 * @throws Error if user doesn't have access
	 */
	private async verifyProjectAccess(
		projectId: string,
		userId: string
	): Promise<void> {
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

		if (result.length === 0) {
			throw new Error('Project not found or access denied')
		}
	}
}

export const sceneFolderService = new SceneFolderService()
