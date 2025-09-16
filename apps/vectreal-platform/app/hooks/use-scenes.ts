import { useMemo } from 'react'

import { useAuth } from '../contexts/auth-context'
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
 * Hook to get all scenes accessible to the user
 */
export const useScenes = (): SceneWithProject[] => {
	const { scenes } = useAuth()
	return scenes
}

/**
 * Hook to get all scene folders accessible to the user
 */
export const useSceneFolders = (): SceneFolderWithProject[] => {
	const { sceneFolders } = useAuth()
	return sceneFolders
}

/**
 * Hook to get all scenes for a specific project
 */
export const useProjectScenes = (projectId: string): SceneWithProject[] => {
	const { scenes } = useAuth()

	return useMemo(() => {
		return scenes.filter(
			({ projectId: sceneProjectId }) => sceneProjectId === projectId
		)
	}, [scenes, projectId])
}

/**
 * Hook to get a specific scene by ID
 */
export const useScene = (sceneId: string): SceneWithProject | null => {
	const { scenes } = useAuth()

	return useMemo(() => {
		return scenes.find(({ scene }) => scene.id === sceneId) || null
	}, [scenes, sceneId])
}

/**
 * Hook to get scenes in a specific folder
 */
export const useFolderScenes = (folderId: string): SceneWithProject[] => {
	const { scenes } = useAuth()

	return useMemo(() => {
		return scenes.filter(({ scene }) => scene.folderId === folderId)
	}, [scenes, folderId])
}

/**
 * Hook to get root scenes (not in any folder) for a project
 */
export const useRootScenes = (projectId: string): SceneWithProject[] => {
	const { scenes } = useAuth()

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
	projectId: string
): SceneFolderWithProject[] => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		return sceneFolders.filter(
			({ projectId: folderProjectId }) => folderProjectId === projectId
		)
	}, [sceneFolders, projectId])
}

/**
 * Hook to get root scene folders (no parent) for a project
 */
export const useRootSceneFolders = (
	projectId: string
): SceneFolderWithProject[] => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		return sceneFolders.filter(
			({ folder, projectId: folderProjectId }) =>
				folderProjectId === projectId && !folder.parentFolderId
		)
	}, [sceneFolders, projectId])
}

/**
 * Hook to get a specific scene folder by ID
 */
export const useSceneFolder = (
	folderId: string
): SceneFolderWithProject | null => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		return sceneFolders.find(({ folder }) => folder.id === folderId) || null
	}, [sceneFolders, folderId])
}

/**
 * Hook to get child folders of a parent folder
 */
export const useChildSceneFolders = (
	parentFolderId: string
): SceneFolderWithProject[] => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		return sceneFolders.filter(
			({ folder }) => folder.parentFolderId === parentFolderId
		)
	}, [sceneFolders, parentFolderId])
}

/**
 * Hook to get project content organized by hierarchy
 */
export const useProjectContent = (projectId: string): ProjectContent => {
	const { sceneFolders, scenes } = useAuth()

	return useMemo(() => {
		const projectFolders = sceneFolders.filter(
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
	}, [projectId, sceneFolders, scenes])
}

/**
 * Hook to get folder content (subfolders and scenes)
 */
export const useFolderContent = (
	folderId: string
): Omit<FolderContent, 'folder'> | null => {
	const { sceneFolders, scenes } = useAuth()

	return useMemo(() => {
		const subfolders = sceneFolders.filter(
			({ folder }) => folder.parentFolderId === folderId
		)
		const folderScenes = scenes.filter(
			({ scene }) => scene.folderId === folderId
		)

		return {
			subfolders,
			scenes: folderScenes
		}
	}, [folderId, sceneFolders, scenes])
}

/**
 * Hook to get scene statistics
 */
export const useSceneStats = () => {
	const { scenes } = useAuth()

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
export const useFilteredScenes = (searchTerm?: string, status?: string) => {
	const { scenes } = useAuth()

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
export const useSortedScenes = () => {
	const { scenes } = useAuth()

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
export const useSceneFolderStats = () => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		const total = sceneFolders.length
		const byProject = sceneFolders.reduce(
			(acc, { projectId }) => {
				acc[projectId] = (acc[projectId] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		const rootFolders = sceneFolders.filter(
			({ folder }) => !folder.parentFolderId
		)
		const nestedFolders = sceneFolders.filter(
			({ folder }) => folder.parentFolderId
		)

		return {
			total,
			byProject,
			rootFoldersCount: rootFolders.length,
			nestedFoldersCount: nestedFolders.length,
			hasFolders: total > 0,
			hasMultipleFolders: total > 1,
			hasNestedFolders: nestedFolders.length > 0
		}
	}, [sceneFolders])
}

/**
 * Hook to get recent scenes (by update time)
 */
export const useRecentScenes = (limit = 5) => {
	const { scenes } = useAuth()

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
	folderId: string
): Array<{ id: string; name: string }> => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		const breadcrumbs: Array<{ id: string; name: string }> = []
		const folderMap = new Map(
			sceneFolders.map(({ folder }) => [folder.id, folder])
		)

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
	}, [folderId, sceneFolders])
}

/**
 * Hook to check if user has access to a specific scene
 */
export const useHasSceneAccess = (sceneId: string): boolean => {
	const { scenes } = useAuth()

	return useMemo(() => {
		return scenes.some(({ scene }) => scene.id === sceneId)
	}, [scenes, sceneId])
}

/**
 * Hook to check if user has access to a specific scene folder
 */
export const useHasSceneFolderAccess = (folderId: string): boolean => {
	const { sceneFolders } = useAuth()

	return useMemo(() => {
		return sceneFolders.some(({ folder }) => folder.id === folderId)
	}, [sceneFolders, folderId])
}

/**
 * Hook to get scenes grouped by project
 */
export const useScenesByProject = () => {
	const { scenes, projects } = useAuth()

	return useMemo(() => {
		const grouped = new Map<
			string,
			{
				project: (typeof projects)[0]['project']
				scenes: SceneWithProject[]
			}
		>()

		// Initialize with all projects
		projects.forEach(({ project }) => {
			grouped.set(project.id, {
				project,
				scenes: []
			})
		})

		// Group scenes by project
		scenes.forEach((sceneWithProject) => {
			const existing = grouped.get(sceneWithProject.projectId)
			if (existing) {
				existing.scenes.push(sceneWithProject)
			}
		})

		return Array.from(grouped.values())
	}, [scenes, projects])
}

/**
 * Hook to get scene folders grouped by project
 */
export const useSceneFoldersByProject = () => {
	const { sceneFolders, projects } = useAuth()

	return useMemo(() => {
		const grouped = new Map<
			string,
			{
				project: (typeof projects)[0]['project']
				folders: SceneFolderWithProject[]
			}
		>()

		// Initialize with all projects
		projects.forEach(({ project }) => {
			grouped.set(project.id, {
				project,
				folders: []
			})
		})

		// Group folders by project
		sceneFolders.forEach((folderWithProject) => {
			const existing = grouped.get(folderWithProject.projectId)
			if (existing) {
				existing.folders.push(folderWithProject)
			}
		})

		return Array.from(grouped.values())
	}, [sceneFolders, projects])
}
