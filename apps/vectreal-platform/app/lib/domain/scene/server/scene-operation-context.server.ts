import { randomUUID } from 'crypto'

import { sceneSettingsService } from './scene-settings-service.server'
import { getProject } from '../../project/project-repository.server'
import { getOrCreateDefaultProject } from '../../user/user-repository.server'

export function assertParsed<T>(value: T, message: string): asserts value is T {
	if (!value) {
		throw new Error(message)
	}
}

/**
 * Creates a new scene in the user's default project
 */
async function createNewScene(
	userId: string
): Promise<{ sceneId: string; projectId: string }> {
	const newSceneId = randomUUID()
	const project = await getOrCreateDefaultProject(userId)
	return { sceneId: newSceneId, projectId: project.id }
}

/**
 * Resolves scene and project IDs, creating a new scene if needed
 */
export async function resolveSceneAndProject(
	sceneId: string | undefined,
	userId: string,
	targetProjectId?: string,
	projectId?: string
): Promise<{
	sceneId: string
	projectId: string
	existingProjectId: string | null
}> {
	if (sceneId?.trim()) {
		const existingProjectId =
			await sceneSettingsService.getProjectIdFromScene(sceneId)

		if (existingProjectId) {
			const resolvedProjectId = targetProjectId ?? existingProjectId
			return { sceneId, projectId: resolvedProjectId, existingProjectId }
		}

		const fallbackProjectId = targetProjectId ?? projectId
		if (fallbackProjectId) {
			const project = await getProject(fallbackProjectId, userId)
			if (!project) {
				throw new Error('Target project not found or access denied')
			}

			return { sceneId, projectId: fallbackProjectId, existingProjectId: null }
		}

		throw new Error(`Scene not found with ID: ${sceneId}`)
	}

	// Create new scene if no ID provided
	if (targetProjectId) {
		const project = await getProject(targetProjectId, userId)
		if (!project) {
			throw new Error('Target project not found or access denied')
		}

		return {
			sceneId: randomUUID(),
			projectId: targetProjectId,
			existingProjectId: null
		}
	}

	const created = await createNewScene(userId)
	return { ...created, existingProjectId: null }
}
