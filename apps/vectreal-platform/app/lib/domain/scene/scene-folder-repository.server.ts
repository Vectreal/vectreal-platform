import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { projects } from '../../../db/schema/project/projects'
import { sceneFolders } from '../../../db/schema/project/scene-folders'
import { scenes } from '../../../db/schema/project/scenes'

const db = getDbClient()
const MAX_FOLDER_ANCESTRY_DEPTH = 50

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

		if (depth > MAX_FOLDER_ANCESTRY_DEPTH) {
			throw new Error('Folder hierarchy exceeds supported depth')
		}
	}

	return ancestry.reverse()
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

	await verifyProjectAccess(db, params.projectId, params.userId)

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

	const scene = await getScene(sceneId, userId)
	if (!scene) {
		throw new Error('Scene not found or access denied')
	}

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

export async function renameSceneFolder(
	folderId: string,
	userId: string,
	name: string
): Promise<typeof sceneFolders.$inferSelect> {
	const trimmedName = name.trim()
	if (!trimmedName) {
		throw new Error('Folder name is required')
	}

	const folder = await getSceneFolder(folderId, userId)
	if (!folder) {
		throw new Error('Folder not found or access denied')
	}

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

export async function deleteScene(
	sceneId: string,
	userId: string
): Promise<void> {
	const scene = await getScene(sceneId, userId)
	if (!scene) {
		throw new Error('Scene not found or access denied')
	}

	await db.delete(scenes).where(eq(scenes.id, sceneId))
}

export async function deleteSceneFolder(
	folderId: string,
	userId: string
): Promise<void> {
	const folder = await getSceneFolder(folderId, userId)
	if (!folder) {
		throw new Error('Folder not found or access denied')
	}

	await db.transaction(async (tx) => {
		await tx
			.update(scenes)
			.set({ folderId: null, updatedAt: new Date() })
			.where(eq(scenes.folderId, folderId))

		await tx.delete(sceneFolders).where(eq(sceneFolders.id, folderId))
	})
}
