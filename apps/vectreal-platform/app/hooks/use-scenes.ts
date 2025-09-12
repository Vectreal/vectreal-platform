import { useMemo } from 'react'

import type { sceneFolders, scenes } from '../db/schema'

/**
 * Types for scene and folder data with relationships
 */
export interface SceneWithProject {
	scene: typeof scenes.$inferSelect
	projectId: string
}

export interface SceneFolderWithProject {
	folder: typeof sceneFolders.$inferSelect
	projectId: string
}

export interface ProjectContent {
	folders: SceneFolderWithProject[]
	scenes: SceneWithProject[]
}

export interface FolderContent {
	folder: typeof sceneFolders.$inferSelect
	subfolders: SceneFolderWithProject[]
	scenes: SceneWithProject[]
}

/**
 * Hook to get all scenes for a project
 */
export const useProjectScenes = (
	projectId: string,
	scenes: SceneWithProject[]
): SceneWithProject[] => {
	return useMemo(() => {
		return scenes.filter(
			({ projectId: sceneProjectId }) => sceneProjectId === projectId
		)
	}, [scenes, projectId])
}

/**
 * Hook to get a specific scene by ID
 */
export const useScene = (
	sceneId: string,
	scenes: SceneWithProject[]
): SceneWithProject | null => {
	return useMemo(() => {
		return scenes.find(({ scene }) => scene.id === sceneId) || null
	}, [scenes, sceneId])
}

/**
 * Hook to get scenes in a specific folder
 */
export const useFolderScenes = (
	folderId: string,
	scenes: SceneWithProject[]
): SceneWithProject[] => {
	return useMemo(() => {
		return scenes.filter(({ scene }) => scene.folderId === folderId)
	}, [scenes, folderId])
}

/**
 * Hook to get root scenes (not in any folder) for a project
 */
export const useRootScenes = (
	projectId: string,
	scenes: SceneWithProject[]
): SceneWithProject[] => {
	return useMemo(() => {
		return scenes.filter(
			({ scene, projectId: sceneProjectId }) =>
				sceneProjectId === projectId && !scene.folderId
		)
	}, [scenes, projectId])
}

/**
 * Hook to get all scene folders for a project
 */
export const useProjectSceneFolders = (
	projectId: string,
	folders: SceneFolderWithProject[]
): SceneFolderWithProject[] => {
	return useMemo(() => {
		return folders.filter(
			({ projectId: folderProjectId }) => folderProjectId === projectId
		)
	}, [folders, projectId])
}

/**
 * Hook to get root scene folders (no parent) for a project
 */
export const useRootSceneFolders = (
	projectId: string,
	folders: SceneFolderWithProject[]
): SceneFolderWithProject[] => {
	return useMemo(() => {
		return folders.filter(
			({ folder, projectId: folderProjectId }) =>
				folderProjectId === projectId && !folder.parentFolderId
		)
	}, [folders, projectId])
}

/**
 * Hook to get a specific scene folder by ID
 */
export const useSceneFolder = (
	folderId: string,
	folders: SceneFolderWithProject[]
): SceneFolderWithProject | null => {
	return useMemo(() => {
		return folders.find(({ folder }) => folder.id === folderId) || null
	}, [folders, folderId])
}

/**
 * Hook to get child folders of a parent folder
 */
export const useChildSceneFolders = (
	parentFolderId: string,
	folders: SceneFolderWithProject[]
): SceneFolderWithProject[] => {
	return useMemo(() => {
		return folders.filter(
			({ folder }) => folder.parentFolderId === parentFolderId
		)
	}, [folders, parentFolderId])
}

/**
 * Hook to get project content organized by hierarchy
 */
export const useProjectContent = (
	projectId: string,
	folders: SceneFolderWithProject[],
	scenes: SceneWithProject[]
): ProjectContent => {
	return useMemo(() => {
		const projectFolders = folders.filter(
			({ folder, projectId: folderProjectId }) =>
				folderProjectId === projectId && !folder.parentFolderId
		)

		const projectScenes = scenes.filter(
			({ scene, projectId: sceneProjectId }) =>
				sceneProjectId === projectId && !scene.folderId
		)

		return {
			folders: projectFolders,
			scenes: projectScenes
		}
	}, [projectId, folders, scenes])
}

/**
 * Hook to get folder content (subfolders and scenes)
 */
export const useFolderContent = (
	folderId: string,
	folders: SceneFolderWithProject[],
	scenes: SceneWithProject[]
): Omit<FolderContent, 'folder'> | null => {
	return useMemo(() => {
		const subfolders = folders.filter(
			({ folder }) => folder.parentFolderId === folderId
		)
		const folderScenes = scenes.filter(
			({ scene }) => scene.folderId === folderId
		)

		return {
			subfolders,
			scenes: folderScenes
		}
	}, [folderId, folders, scenes])
}

/**
 * Hook to get scene statistics
 */
export const useSceneStats = (scenes: SceneWithProject[]) => {
	return useMemo(() => {
		const total = scenes.length
		const byStatus = scenes.reduce(
			(acc, { scene }) => {
				acc[scene.status] = (acc[scene.status] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		const byProject = scenes.reduce(
			(acc, { projectId }) => {
				acc[projectId] = (acc[projectId] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		return {
			total,
			byStatus,
			byProject,
			hasScenes: total > 0,
			hasMultipleScenes: total > 1
		}
	}, [scenes])
}

/**
 * Hook to get scenes filtered by search term and status
 */
export const useFilteredScenes = (
	scenes: SceneWithProject[],
	searchTerm?: string,
	status?: string
) => {
	return useMemo(() => {
		let filtered = scenes

		// Filter by search term
		if (searchTerm) {
			const term = searchTerm.toLowerCase()
			filtered = filtered.filter(
				({ scene }) =>
					scene.name.toLowerCase().includes(term) ||
					(scene.description && scene.description.toLowerCase().includes(term))
			)
		}

		// Filter by status
		if (status && status !== 'all') {
			filtered = filtered.filter(({ scene }) => scene.status === status)
		}

		return filtered
	}, [scenes, searchTerm, status])
}

/**
 * Hook to get scenes sorted by various criteria
 */
export const useSortedScenes = (scenes: SceneWithProject[]) => {
	return useMemo(() => {
		const byName = [...scenes].sort((a, b) =>
			a.scene.name.localeCompare(b.scene.name)
		)

		const byUpdated = [...scenes].sort(
			(a, b) =>
				new Date(b.scene.updatedAt).getTime() -
				new Date(a.scene.updatedAt).getTime()
		)

		const byCreated = [...scenes].sort(
			(a, b) =>
				new Date(b.scene.createdAt).getTime() -
				new Date(a.scene.createdAt).getTime()
		)

		const byStatus = [...scenes].sort((a, b) =>
			a.scene.status.localeCompare(b.scene.status)
		)

		return {
			byName,
			byUpdated,
			byCreated,
			byStatus,
			default: scenes // Original order from the server
		}
	}, [scenes])
}

/**
 * Hook to get scene folder statistics
 */
export const useSceneFolderStats = (folders: SceneFolderWithProject[]) => {
	return useMemo(() => {
		const total = folders.length
		const byProject = folders.reduce(
			(acc, { projectId }) => {
				acc[projectId] = (acc[projectId] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		const rootFolders = folders.filter(({ folder }) => !folder.parentFolderId)
		const nestedFolders = folders.filter(({ folder }) => folder.parentFolderId)

		return {
			total,
			byProject,
			rootFoldersCount: rootFolders.length,
			nestedFoldersCount: nestedFolders.length,
			hasFolders: total > 0,
			hasMultipleFolders: total > 1,
			hasNestedFolders: nestedFolders.length > 0
		}
	}, [folders])
}

/**
 * Hook to get recent scenes (by update time)
 */
export const useRecentScenes = (scenes: SceneWithProject[], limit = 5) => {
	return useMemo(() => {
		return [...scenes]
			.sort(
				(a, b) =>
					new Date(b.scene.updatedAt).getTime() -
					new Date(a.scene.updatedAt).getTime()
			)
			.slice(0, limit)
	}, [scenes, limit])
}

/**
 * Hook to build breadcrumb path for a folder
 */
export const useFolderBreadcrumbs = (
	folderId: string,
	folders: SceneFolderWithProject[]
): Array<{ id: string; name: string }> => {
	return useMemo(() => {
		const breadcrumbs: Array<{ id: string; name: string }> = []
		const folderMap = new Map(folders.map(({ folder }) => [folder.id, folder]))

		let currentFolderId: string | null = folderId

		while (currentFolderId) {
			const currentFolder = folderMap.get(currentFolderId)

			if (!currentFolder) break

			breadcrumbs.unshift({
				id: currentFolder.id,
				name: currentFolder.name
			})

			currentFolderId = currentFolder.parentFolderId
		}

		return breadcrumbs
	}, [folderId, folders])
}
