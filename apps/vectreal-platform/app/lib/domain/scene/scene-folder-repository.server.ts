import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { projects } from '../../../db/schema/project/projects'
import { sceneFolders } from '../../../db/schema/project/scene-folders'
import { scenes } from '../../../db/schema/project/scenes'

const db = getDbClient()

type DbClient = typeof db

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
	const [folder] = await db
		.select()
		.from(sceneFolders)
		.where(eq(sceneFolders.id, folderId))
		.limit(1)

	if (!folder) {
		return null
	}

	await verifyProjectAccess(db, folder.projectId, userId)

	return folder
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
