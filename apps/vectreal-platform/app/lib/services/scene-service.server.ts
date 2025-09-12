import { and, desc, eq, isNull } from 'drizzle-orm'

import { getDbClient } from '../../db/client'
import { organizationMemberships } from '../../db/schema/core/organization-memberships'
import { projects } from '../../db/schema/project/projects'
import { sceneFolders } from '../../db/schema/project/scene-folders'
import { scenes } from '../../db/schema/project/scenes'

/**
 * Service for scene-related database operations.
 */
export class SceneService {
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
	 * Creates a new scene in a project.
	 * @param projectId - The project ID
	 * @param name - The scene name
	 * @param description - Optional scene description
	 * @param folderId - Optional folder ID
	 * @param userId - The user ID (for permission check)
	 * @returns Created scene record
	 */
	async createScene(
		projectId: string,
		name: string,
		description?: string,
		folderId?: string,
		userId?: string
	): Promise<typeof scenes.$inferSelect> {
		if (userId) {
			// Verify user has access to create scenes in this project
			await this.verifyProjectAccess(projectId, userId)
		}

		// If folder ID is provided, verify it belongs to the same project
		if (folderId) {
			const folder = await this.db
				.select()
				.from(sceneFolders)
				.where(
					and(
						eq(sceneFolders.id, folderId),
						eq(sceneFolders.projectId, projectId)
					)
				)
				.limit(1)

			if (folder.length === 0) {
				throw new Error('Folder not found in this project')
			}
		}

		const [newScene] = await this.db
			.insert(scenes)
			.values({
				projectId,
				name,
				description,
				folderId
			})
			.returning()

		return newScene
	}

	/**
	 * Updates a scene.
	 * @param sceneId - The scene ID
	 * @param updates - The updates to apply
	 * @param userId - The user ID (for permission check)
	 * @returns Updated scene record
	 */
	async updateScene(
		sceneId: string,
		updates: Partial<
			Pick<
				typeof scenes.$inferSelect,
				'name' | 'description' | 'status' | 'folderId'
			>
		>,
		userId: string
	): Promise<typeof scenes.$inferSelect> {
		// First verify user has edit permissions
		const scene = await this.getScene(sceneId, userId)
		if (!scene) {
			throw new Error('Scene not found or access denied')
		}

		const [updatedScene] = await this.db
			.update(scenes)
			.set({
				...updates,
				updatedAt: new Date()
			})
			.where(eq(scenes.id, sceneId))
			.returning()

		return updatedScene
	}

	/**
	 * Deletes a scene.
	 * @param sceneId - The scene ID
	 * @param userId - The user ID (for permission check)
	 */
	async deleteScene(sceneId: string, userId: string): Promise<void> {
		// First verify user has delete permissions
		const scene = await this.getScene(sceneId, userId)
		if (!scene) {
			throw new Error('Scene not found or access denied')
		}

		// Additional permission check for deletion (only admin/owner can delete)
		const result = await this.db
			.select({
				membership: organizationMemberships
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

		const { membership } = result[0] || {}
		if (!membership || !['admin', 'owner'].includes(membership.role)) {
			throw new Error('Insufficient permissions to delete this scene')
		}

		await this.db.delete(scenes).where(eq(scenes.id, sceneId))
	}

	/**
	 * Gets all scene folders for a project.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 * @returns Array of scene folders
	 */
	async getProjectSceneFolders(
		projectId: string,
		userId: string
	): Promise<Array<typeof sceneFolders.$inferSelect>> {
		// First verify user has access to the project
		await this.verifyProjectAccess(projectId, userId)

		return await this.db
			.select()
			.from(sceneFolders)
			.where(eq(sceneFolders.projectId, projectId))
			.orderBy(desc(sceneFolders.updatedAt))
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
	 * Creates a new scene folder.
	 * @param projectId - The project ID
	 * @param name - The folder name
	 * @param description - Optional folder description
	 * @param parentFolderId - Optional parent folder ID
	 * @param userId - The user ID (for permission check and ownership)
	 * @returns Created scene folder record
	 */
	async createSceneFolder(
		projectId: string,
		name: string,
		description?: string,
		parentFolderId?: string,
		userId?: string
	): Promise<typeof sceneFolders.$inferSelect> {
		if (userId) {
			// Verify user has access to create folders in this project
			await this.verifyProjectAccess(projectId, userId)
		}

		// If parent folder ID is provided, verify it belongs to the same project
		if (parentFolderId) {
			const parentFolder = await this.db
				.select()
				.from(sceneFolders)
				.where(
					and(
						eq(sceneFolders.id, parentFolderId),
						eq(sceneFolders.projectId, projectId)
					)
				)
				.limit(1)

			if (parentFolder.length === 0) {
				throw new Error('Parent folder not found in this project')
			}
		}

		if (!userId) {
			throw new Error('User ID is required to create a folder')
		}

		const [newFolder] = await this.db
			.insert(sceneFolders)
			.values({
				projectId,
				name,
				description,
				parentFolderId,
				ownerId: userId
			})
			.returning()

		return newFolder
	}

	/**
	 * Gets project content (folders and scenes) organized by hierarchy.
	 * @param projectId - The project ID
	 * @param userId - The user ID (for permission check)
	 * @returns Object with root folders and scenes
	 */
	async getProjectContent(
		projectId: string,
		userId: string
	): Promise<{
		folders: Array<typeof sceneFolders.$inferSelect>
		scenes: Array<typeof scenes.$inferSelect>
	}> {
		// Verify user has access to the project
		await this.verifyProjectAccess(projectId, userId)

		const [folders, rootScenes] = await Promise.all([
			this.getRootSceneFolders(projectId, userId),
			this.getRootScenes(projectId, userId)
		])

		return {
			folders,
			scenes: rootScenes
		}
	}

	/**
	 * Gets folder content (subfolders and scenes).
	 * @param folderId - The folder ID
	 * @param userId - The user ID (for permission check)
	 * @returns Object with subfolders and scenes in the folder
	 */
	async getFolderContent(
		folderId: string,
		userId: string
	): Promise<{
		folder: typeof sceneFolders.$inferSelect
		subfolders: Array<typeof sceneFolders.$inferSelect>
		scenes: Array<typeof scenes.$inferSelect>
	}> {
		const folder = await this.getSceneFolder(folderId, userId)
		if (!folder) {
			throw new Error('Folder not found or access denied')
		}

		const [subfolders, folderScenes] = await Promise.all([
			this.getChildFolders(folderId, userId),
			this.getFolderScenes(folderId, userId)
		])

		return {
			folder,
			subfolders,
			scenes: folderScenes
		}
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

export const sceneService = new SceneService()
